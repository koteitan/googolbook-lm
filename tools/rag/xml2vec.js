#!/usr/bin/env node
/**
 * Node.js版 Vector Store Creation Tool
 * 
 * Pythonのxml2vec.pyをNode.jsに移植
 * Transformers.jsを使用してWeb版と完全に同じembeddingを生成
 */

import { pipeline } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * YAML設定ファイルから設定を読み込み
 */
async function loadConfig(site = 'ja-googology-wiki') {
    const configPath = path.join(__dirname, `../../data/${site}/config.yml`);
    
    try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = yaml.load(configContent);
        
        console.log(`Configuration loaded from: ${configPath}`);
        console.log(`Tokenization mode: ${config.tokenize?.mode || 'normal'}`);
        
        return config;
    } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error.message);
        console.log('Using default configuration');
        
        // デフォルト設定
        return {
            vector_store: {
                chunks_per_part: 10000,
                content_search_per_part: 10,
                content_search_final_count: 5
            },
            tokenize: {
                mode: 'tinysegmenter'
            }
        };
    }
}

// TinySegmenterの実装（rag-common.jsと同じ）
class TinySegmenter {
    constructor() {
        this.patterns = {
            hiragana: /[\u3041-\u3096]/,
            katakana: /[\u30A1-\u30F6]/,
            kanji: /[\u4E00-\u9FAF]/,
            latin: /[A-Za-z]/,
            digit: /[0-9]/
        };
    }

    segment(text) {
        if (!text) return [];
        
        const result = [];
        let currentToken = '';
        let currentType = null;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charType = this.getCharType(char);
            
            if (currentType === null) {
                currentType = charType;
                currentToken = char;
            } else if (currentType === charType) {
                currentToken += char;
            } else {
                if (currentToken) {
                    result.push(currentToken);
                }
                currentToken = char;
                currentType = charType;
            }
        }
        
        if (currentToken) {
            result.push(currentToken);
        }
        
        return result;
    }

    tokenizeWakati(text) {
        const tokens = this.segment(text);
        return tokens.join(' ');
    }

    getCharType(char) {
        if (this.patterns.hiragana.test(char)) return 'hiragana';
        if (this.patterns.katakana.test(char)) return 'katakana';
        if (this.patterns.kanji.test(char)) return 'kanji';
        if (this.patterns.latin.test(char)) return 'latin';
        if (this.patterns.digit.test(char)) return 'digit';
        return 'other';
    }
}

/**
 * テキストを指定されたサイズでチャンクに分割
 */
function splitText(text, chunkSize = 1200, chunkOverlap = 300) {
    if (!text || text.length <= chunkSize) {
        return [text];
    }
    
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
        let end = start + chunkSize;
        
        // チャンクの境界で文や段落の区切りを探す
        if (end < text.length) {
            // まず段落区切り（\n\n）を探す
            const paragraphBreak = text.lastIndexOf('\n\n', end);
            if (paragraphBreak > start + chunkSize * 0.5) {
                end = paragraphBreak + 2;
            } else {
                // 次に文区切り（。！？）を探す
                const sentenceBreak = text.search(/[。！？][^\w]/);
                if (sentenceBreak > start + chunkSize * 0.7 && sentenceBreak < end) {
                    end = sentenceBreak + 1;
                } else {
                    // 最後に改行を探す
                    const lineBreak = text.lastIndexOf('\n', end);
                    if (lineBreak > start + chunkSize * 0.7) {
                        end = lineBreak + 1;
                    }
                }
            }
        }
        
        const chunk = text.substring(start, end).trim();
        if (chunk) {
            chunks.push(chunk);
        }
        
        // オーバーラップを考慮して次の開始位置を設定
        start = Math.max(start + chunkSize - chunkOverlap, end);
        
        // 無限ループ防止
        if (start === end - chunkOverlap) {
            start = end;
        }
    }
    
    return chunks.filter(chunk => chunk.length > 50); // 短すぎるチャンクは除外
}

/**
 * Check if a page should be excluded based on exclusion rules
 */
function shouldExcludePage(pageTitle, config) {
    // Convert numeric titles to strings
    if (pageTitle && typeof pageTitle !== 'string') {
        pageTitle = pageTitle.toString();
    }
    
    // Ensure pageTitle is valid and config exists
    if (!pageTitle || !config?.exclusions) {
        return false;
    }
    
    // Check namespace exclusions
    if (config.exclusions.namespaces) {
        for (const namespace of config.exclusions.namespaces) {
            if (pageTitle.startsWith(namespace + ':')) {
                // Silently exclude - no log output
                return true;
            }
        }
    }
    
    // Check username exclusions (for user pages)
    if (config.exclusions.usernames && pageTitle.startsWith('ユーザー:')) {
        const username = pageTitle.split(':')[1]?.split('/')[0];
        if (username && config.exclusions.usernames.includes(username)) {
            // Silently exclude - no log output
            return true;
        }
    }
    
    return false;
}

/**
 * MediaWiki XMLを解析してドキュメントを抽出
 */
async function loadMediaWikiDocuments(xmlPath, createTitleStore = false, chunkSize = 1200, chunkOverlap = 300, config = null) {
    console.log(`Loading XML from: ${xmlPath}`);
    console.log(`Mode: ${createTitleStore ? 'Title store' : 'Content store with chunking'}`);
    
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    
    const result = parser.parse(xmlContent);
    const pages = result.mediawiki.page || [];
    
    console.log(`Found ${pages.length} pages in XML`);
    
    // Step 1: Build redirect mapping and page content mapping
    const redirectMap = new Map(); // redirect title -> target title
    const pageContentMap = new Map(); // page title -> {content, id, ...}
    const titleToIdMap = new Map(); // page title -> page id
    let redirectCount = 0;
    
    // First pass: collect all pages and build redirect mapping
    for (const page of pages) {
        // Convert numeric titles to strings
        let title = page.title;
        if (title && typeof title !== 'string') {
            title = title.toString();
        }
        const id = page.id?.toString() || '';
        
        titleToIdMap.set(title, id);
        
        // Check if this is a redirect page
        if (page.redirect && page.redirect['@_title']) {
            const redirectTarget = page.redirect['@_title'];
            redirectMap.set(title, redirectTarget);
            redirectCount++;
        } else if (page.revision && page.revision.text && page.revision.text['#text']) {
            // Regular page with content
            pageContentMap.set(title, {
                content: page.revision.text['#text'],
                id: id,
                page: page
            });
        }
    }
    
    console.log(`Found ${redirectCount} redirect pages, building redirect chain resolution...`);
    
    // Debug: Check a few redirect examples
    const redirectExamples = Array.from(redirectMap.entries()).slice(0, 3);
    console.log(`Redirect examples:`, redirectExamples);
    
    // Function to resolve redirect chains
    function resolveRedirectChain(title, visited = new Set()) {
        if (visited.has(title)) {
            console.warn(`Circular redirect detected for: ${title}`);
            return title; // Return original to avoid infinite loop
        }
        
        visited.add(title);
        const target = redirectMap.get(title);
        
        if (target && redirectMap.has(target)) {
            return resolveRedirectChain(target, visited);
        }
        
        return target || title;
    }
    
    const documents = [];
    let totalChunks = 0;
    let excludedCount = 0;
    let redirectResolvedCount = 0;
    
    // Step 2: Process all pages, resolving redirects for content
    for (const page of pages) {
        // Convert numeric titles to strings
        let originalTitle = page.title;
        if (originalTitle && typeof originalTitle !== 'string') {
            originalTitle = originalTitle.toString();
        }
        
        // Check if page should be excluded
        if (shouldExcludePage(originalTitle, config)) {
            excludedCount++;
            continue;
        }
        
        let contentToUse = null;
        let targetTitle = originalTitle;
        let targetId = page.id?.toString() || '';
        
        // Check if this is a redirect page (check redirect tag first)
        if (page.redirect && page.redirect['@_title']) {
            // This is a redirect page
            if (originalTitle === '超限順序数の一覧' || originalTitle === '2147483647' || originalTitle === 'グラハム数') {
                console.log(`DEBUG: Found redirect page ${originalTitle}, createTitleStore=${createTitleStore}, page.redirect=`, page.redirect);
            }
            
            if (createTitleStore) {
                // For title store: include redirect pages with original title
                const redirectTarget = page.redirect['@_title'];
                const doc = {
                    pageContent: originalTitle,
                    metadata: {
                        title: originalTitle,
                        curid: page.id?.toString() || '',
                        source: originalTitle,
                        redirect_target: redirectTarget
                    }
                };
                documents.push(doc);
                redirectResolvedCount++;
            } else {
                // For content store: skip redirect pages to avoid duplication
                // The target page will already be included with its own content
                if (originalTitle === '超限順序数の一覧' || originalTitle === '2147483647') {
                    console.log(`DEBUG: Skipping redirect page ${originalTitle} for content store`);
                }
                redirectResolvedCount++;
                continue;
            }
        } else if (page.revision && page.revision.text && page.revision.text['#text']) {
            // Regular page with content (not a redirect)
            if (originalTitle === '超限順序数の一覧' || originalTitle === '2147483647' || originalTitle === 'グラハム数') {
                console.log(`DEBUG: Processing regular page ${originalTitle}, page.redirect=`, page.redirect, 'hasRedirect=', !!page.redirect);
            }
            contentToUse = page.revision.text['#text'];
            
            if (createTitleStore) {
                // タイトルストア用：通常ページのタイトル
                const doc = {
                    pageContent: originalTitle,
                    metadata: {
                        title: originalTitle,
                        curid: page.id?.toString() || '',
                        source: originalTitle
                    }
                };
                if (originalTitle === 'グラハム数') {
                    console.log(`DEBUG: Adding ${originalTitle} to title store with curid=${page.id}`);
                }
                documents.push(doc);
            } else {
                // コンテンツストア用：通常ページの内容をチャンク分割
                const chunks = splitText(contentToUse, chunkSize, chunkOverlap);
                
                totalChunks += chunks.length;
                
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const doc = {
                        pageContent: chunk,
                        metadata: {
                            title: originalTitle,
                            curid: page.id?.toString() || '',
                            source: originalTitle,
                            chunk_index: i,
                            total_chunks: chunks.length
                        }
                    };
                    documents.push(doc);
                }
            }
        } else {
            // Skip pages without content
            continue;
        }
    }
    
    console.log(`Exclusion summary: ${excludedCount} pages excluded, ${documents.length} pages included`);
    if (createTitleStore) {
        console.log(`Redirect processing: ${redirectResolvedCount} redirect pages included in title store`);
    } else {
        console.log(`Redirect processing: ${redirectResolvedCount} redirect pages skipped to avoid content duplication`);
    }
    
    if (createTitleStore) {
        console.log(`✓ Loaded ${documents.length} title documents`);
    } else {
        console.log(`✓ Loaded ${documents.length} content chunks (total processed chunks: ${totalChunks})`);
    }
    
    return documents;
}

/**
 * Transformers.jsでembeddingを生成
 */
async function createEmbeddings(documents, tokenizeMode = 'normal') {
    console.log('Initializing Transformers.js...');
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    const tinySegmenter = new TinySegmenter();
    console.log('✓ TinySegmenter initialized');
    
    const embeddings = [];
    const processedDocs = [];
    
    console.log(`Processing ${documents.length} documents...`);
    
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        let text = doc.pageContent;
        
        // TinySegmenter処理
        if (tokenizeMode === 'tinysegmenter') {
            text = tinySegmenter.tokenizeWakati(text);
        }
        
        // Embedding生成（Web版と同じ設定）
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        
        embeddings.push(embedding);
        processedDocs.push({
            id: `doc_${i}`,
            content: doc.pageContent,
            metadata: doc.metadata,
            curid: doc.metadata.curid,
            embedding: embedding
        });
        
        process.stdout.write(`\rProcessing ${i + 1}/${documents.length} documents...`);
    }
    
    console.log('✓ All embeddings generated');
    return { documents: processedDocs, embeddings };
}

/**
 * JSONファイルとして保存
 */
async function saveAsJSON(data, outputPath, isContentStore = false) {
    console.log(`Saving to: ${outputPath}`);
    console.log(`🔍 DEBUG: Saving ${data.documents.length} documents`);
    
    // バイナリ形式で保存（Web版互換）
    const jsonData = {
        site: 'ja-googology-wiki',
        part_index: 0,
        part_documents: data.documents.length,
        embedding_dimension: 384,
        documents: data.documents.map(doc => {
            const baseDoc = {
                id: doc.id,
                curid: doc.curid,
                embedding_binary: arrayToBase64(doc.embedding),
                embedding_format: 'float32_base64'
            };
            
            // コンテンツストアの場合はcontentも含める
            if (isContentStore) {
                baseDoc.content = doc.content;
            }
            
            // すべてのストアでmetadataを含める（タイトル検索に必要）
            baseDoc.metadata = doc.metadata;
            
            // デバッグ: グラハム数の保存を確認
            if (doc.metadata && doc.metadata.title === 'グラハム数') {
                console.log(`🔍 DEBUG: Saving グラハム数 with curid=${doc.curid}, metadata=`, doc.metadata);
            }
            
            return baseDoc;
        })
    };
    
    const jsonString = JSON.stringify(jsonData);
    await fs.writeFile(outputPath, jsonString);
    console.log('✓ JSON file saved');
    
    // 圧縮版も作成
    const { gzip } = await import('zlib');
    const { promisify } = await import('util');
    const gzipAsync = promisify(gzip);
    
    const compressed = await gzipAsync(jsonString);
    await fs.writeFile(outputPath + '.gz', compressed);
    console.log('✓ Compressed JSON file saved');
    
    // 実際に保存されたファイルの検証
    const savedData = JSON.parse(jsonString);
    console.log(`🔍 DEBUG: Verification - saved ${savedData.documents.length} documents to file`);
    
    // ファイルサイズ情報を取得
    const stat = await fs.stat(outputPath);
    const statGz = await fs.stat(outputPath + '.gz');
    const jsonSizeMB = stat.size / (1024 * 1024);
    const gzSizeMB = statGz.size / (1024 * 1024);
    
    console.log(`  JSON size: ${jsonSizeMB.toFixed(1)} MB`);
    console.log(`  Compressed size: ${gzSizeMB.toFixed(1)} MB`);
    console.log(`  Compression ratio: ${((1 - gzSizeMB / jsonSizeMB) * 100).toFixed(1)}%`);
    
    return { jsonSizeMB, gzSizeMB };
}

/**
 * メタデータファイルを生成
 */
async function saveMetadata(data, outputPath, isContentStore = false, fileSizes = null) {
    let metaPath;
    if (isContentStore) {
        // コンテンツストアの場合: vector_store_part01.json → vector_store_meta.json
        metaPath = outputPath.replace('_part01.json', '_meta.json');
    } else {
        // タイトルストアの場合: vector_store_titles_part01.json → vector_store_titles_meta.json
        metaPath = outputPath.replace('.json', '_meta.json');
    }
    
    console.log(`Saving metadata to: ${metaPath}`);
    
    const metadata = {
        total_documents: data.documents.length,
        num_parts: 1, // 現在は1パートのみ
        docs_per_part: data.documents.length,
        embedding_dimension: 384
    };
    
    // ファイルサイズ情報があれば追加
    if (fileSizes) {
        metadata.total_json_size_mb = parseFloat(fileSizes.jsonSizeMB.toFixed(1));
        metadata.total_gz_size_mb = parseFloat(fileSizes.gzSizeMB.toFixed(1));
    }
    
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    console.log('✓ Metadata file saved');
    
    return metaPath;
}

/**
 * Float32配列をBase64に変換
 */
function arrayToBase64(floatArray) {
    const float32Array = new Float32Array(floatArray);
    const buffer = float32Array.buffer;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * メイン処理
 */
async function main() {
    const args = process.argv.slice(2);
    
    // コマンドライン引数の解析
    let mode = 'both'; // デフォルトは両方作成
    let xmlPath = path.join(__dirname, '../../data/ja-googology-wiki/jagoogology_pages_current.xml');
    let outputPath = null;
    let chunkSize = null;
    let chunkOverlap = null;
    let site = 'ja-googology-wiki';
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--content') {
            mode = 'content';
        } else if (args[i] === '--title') {
            mode = 'title';
        } else if (args[i] === '--both') {
            mode = 'both';
        } else if (args[i] === '--xml' && i + 1 < args.length) {
            xmlPath = args[i + 1];
            i++;
        } else if (args[i] === '--output' && i + 1 < args.length) {
            outputPath = args[i + 1];
            i++;
        } else if (args[i] === '--chunk-size' && i + 1 < args.length) {
            chunkSize = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--chunk-overlap' && i + 1 < args.length) {
            chunkOverlap = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--site' && i + 1 < args.length) {
            site = args[i + 1];
            i++;
        } else if (!args[i].startsWith('--')) {
            // 最初の非オプション引数はXMLパス
            if (!xmlPath || xmlPath.includes('jagoogology_pages_current.xml')) {
                xmlPath = args[i];
            }
        }
    }
    
    try {
        console.log(`=== Node.js Vector Store Creation (${mode.toUpperCase()} Mode) ===`);
        console.log(`XML Path: ${xmlPath}`);
        
        // 0. 設定ファイルを読み込み
        const config = await loadConfig(site);
        
        // チャンクサイズを決定（優先度: コマンドライン > 設定ファイル > デフォルト）
        const finalChunkSize = chunkSize || (config.vector_store?.chunk_size) || 1200;
        const finalChunkOverlap = chunkOverlap || (config.vector_store?.chunk_overlap) || 300;
        
        if (mode === 'both') {
            // 両方のベクターストアを作成
            console.log(`Chunk settings: size=${finalChunkSize}, overlap=${finalChunkOverlap}`);
            
            // 1. コンテンツベクターストア作成
            console.log('\n=== Creating Content Vector Store ===');
            const contentOutputPath = path.join(__dirname, '../../data/ja-googology-wiki/vector_store_part01.json');
            console.log(`Output Path: ${contentOutputPath}`);
            
            const contentDocuments = await loadMediaWikiDocuments(xmlPath, false, finalChunkSize, finalChunkOverlap, config);
            const contentResult = await createEmbeddings(contentDocuments, config.tokenize?.mode || 'tinysegmenter');
            const contentFileSizes = await saveAsJSON(contentResult, contentOutputPath, true);
            await saveMetadata(contentResult, contentOutputPath, true, contentFileSizes);
            
            console.log(`✓ Content store complete! Total chunks: ${contentResult.documents.length}`);
            console.log(`Content store created with ${finalChunkSize}-char chunks and ${finalChunkOverlap}-char overlap`);
            
            // 2. タイトルベクターストア作成
            console.log('\n=== Creating Title Vector Store ===');
            const titleOutputPath = path.join(__dirname, '../../data/ja-googology-wiki/vector_store_titles_part01.json');
            console.log(`Output Path: ${titleOutputPath}`);
            
            const titleDocuments = await loadMediaWikiDocuments(xmlPath, true, finalChunkSize, finalChunkOverlap, config);
            const titleResult = await createEmbeddings(titleDocuments, config.tokenize?.mode || 'tinysegmenter');
            const titleFileSizes = await saveAsJSON(titleResult, titleOutputPath, false);
            await saveMetadata(titleResult, titleOutputPath, false, titleFileSizes);
            
            console.log(`✓ Title store complete! Total documents: ${titleResult.documents.length}`);
            
            console.log('\n✅ Both vector stores created successfully!');
            console.log('This should resolve the issue with oversized documents in LLM prompts');
            
        } else {
            // 単一モード（従来の動作）
            const singleOutputPath = outputPath || (mode === 'content' 
                ? path.join(__dirname, '../../data/ja-googology-wiki/vector_store_part01.json')
                : path.join(__dirname, '../../data/ja-googology-wiki/vector_store_titles_part01.json'));
            
            console.log(`Output Path: ${singleOutputPath}`);
            
            if (mode === 'content') {
                console.log(`Chunk settings: size=${finalChunkSize}, overlap=${finalChunkOverlap}`);
            }
            
            const createTitleStore = (mode === 'title');
            const documents = await loadMediaWikiDocuments(xmlPath, createTitleStore, finalChunkSize, finalChunkOverlap, config);
            const result = await createEmbeddings(documents, config.tokenize?.mode || 'tinysegmenter');
            const isContentStore = (mode === 'content');
            const fileSizes = await saveAsJSON(result, singleOutputPath, isContentStore);
            await saveMetadata(result, singleOutputPath, isContentStore, fileSizes);
            
            console.log('\n✓ Vector store creation complete!');
            console.log(`Mode: ${mode}`);
            console.log(`Total documents: ${result.documents.length}`);
            console.log(`Output: ${singleOutputPath}`);
            
            if (mode === 'content') {
                console.log(`\nContent store created with ${finalChunkSize}-char chunks and ${finalChunkOverlap}-char overlap`);
                console.log('This should resolve the issue with oversized documents in LLM prompts');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}