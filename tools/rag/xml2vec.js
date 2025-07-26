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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * MediaWiki XMLを解析してドキュメントを抽出
 */
async function loadMediaWikiDocuments(xmlPath) {
    console.log(`Loading XML from: ${xmlPath}`);
    
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    
    const result = parser.parse(xmlContent);
    const pages = result.mediawiki.page || [];
    
    console.log(`Found ${pages.length} pages in XML`);
    
    const documents = [];
    for (const page of pages) {
        if (page.revision && page.revision.text && page.revision.text['#text']) {
            const doc = {
                pageContent: page.title, // titleベクターストア用にタイトルのみ使用
                metadata: {
                    title: page.title,
                    curid: page.id?.toString() || '',
                    source: page.title
                }
            };
            documents.push(doc);
        }
    }
    
    console.log(`✓ Loaded ${documents.length} documents`);
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
        
        if ((i + 1) % 100 === 0) {
            console.log(`  Processed ${i + 1}/${documents.length} documents`);
        }
    }
    
    console.log('✓ All embeddings generated');
    return { documents: processedDocs, embeddings };
}

/**
 * JSONファイルとして保存
 */
async function saveAsJSON(data, outputPath) {
    console.log(`Saving to: ${outputPath}`);
    
    // バイナリ形式で保存（Web版互換）
    const jsonData = {
        site: 'ja-googology-wiki',
        part_index: 0,
        part_documents: data.documents.length,
        embedding_dimension: 384,
        documents: data.documents.map(doc => ({
            id: doc.id,
            curid: doc.curid,
            embedding_binary: arrayToBase64(doc.embedding),
            embedding_format: 'float32_base64'
        }))
    };
    
    await fs.writeFile(outputPath, JSON.stringify(jsonData));
    console.log('✓ JSON file saved');
    
    // 圧縮版も作成
    const { gzip } = await import('zlib');
    const { promisify } = await import('util');
    const gzipAsync = promisify(gzip);
    
    const compressed = await gzipAsync(JSON.stringify(jsonData));
    await fs.writeFile(outputPath + '.gz', compressed);
    console.log('✓ Compressed JSON file saved');
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
    const xmlPath = args[0] || path.join(__dirname, '../../data/ja-googology-wiki/jagoogology_pages_current.xml');
    const outputPath = args[1] || path.join(__dirname, '../../data/ja-googology-wiki/vector_store_titles_part01.json');
    
    try {
        console.log('=== Node.js Vector Store Creation (Title Mode) ===');
        
        // 1. XMLからドキュメントを読み込み
        const documents = await loadMediaWikiDocuments(xmlPath);
        
        // 2. Embeddingを生成（TinySegmenterモード）
        const result = await createEmbeddings(documents, 'tinysegmenter');
        
        // 3. JSONとして保存
        await saveAsJSON(result, outputPath);
        
        console.log('\n✓ Vector store creation complete!');
        console.log(`Total documents: ${result.documents.length}`);
        console.log(`Output: ${outputPath}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}