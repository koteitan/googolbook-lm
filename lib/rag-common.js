// RAG Common Module - Shared functionality across all sites
// Import Transformers.js for HuggingFace embeddings
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js';

// Import YAML parser
import { load as yamlLoad } from 'https://cdn.skypack.dev/js-yaml@4.1.0';

// kuromoji loaded globally via script tag in HTML

// Import pako for compression/decompression  
import pako from 'https://cdn.skypack.dev/pako@2.1.0';

// Show full chunk content in RAG results (same as what LLM sees)
const SHOW_FULL_RAG_CONTENT = true;

// Group search results by document and show top 10 documents (vs. top chunks)
const GROUP_BY_DOCUMENT = true;

// Limit for document size when sending to LLM (in characters)
const DOCUMENT_SIZE_LIMIT = 10000;

// Limit for total prompt size (to avoid OpenAI token limits)
const PROMPT_SIZE_LIMIT = 25000;

// Show the complete prompt sent to LLM (system prompt + context + user query) for debugging
const SHOW_LLM_PROMPT = true;

// Import morphological analyzer from common library
import { globalMorphAnalyzer as japaneseMorphAnalyzer } from './morphological-analyzer.js';

// Enable title-based search (will be fixed by updating vector store)
const USE_TITLE_SEARCH = true;

// Update license information in footer
async function updateLicenseInfo(config) {
    try {
        // Update license link
        const licenseLink = document.getElementById('license-link');
        if (licenseLink && config.license) {
            licenseLink.href = config.license.url;
            licenseLink.textContent = config.license.short;
        }
        
        // Load and display fetch date from fetch_log.txt
        const fetchDateElement = document.getElementById('fetch-date');
        if (fetchDateElement) {
            try {
                const response = await fetch('./fetch_log.txt');
                if (response.ok) {
                    const logContent = await response.text();
                    const firstLine = logContent.split('\n')[0];
                    // Extract date from "Archive fetched: YYYY-MM-DD HH:MM:SS"
                    const dateMatch = firstLine.match(/Archive fetched: (.+)/);
                    if (dateMatch) {
                        fetchDateElement.textContent = dateMatch[1];
                    } else {
                        fetchDateElement.textContent = 'unknown';
                    }
                } else {
                    fetchDateElement.textContent = 'unknown';
                }
            } catch (error) {
                console.warn('Failed to load fetch date:', error);
                fetchDateElement.textContent = 'unknown';
            }
        }
    } catch (error) {
        console.warn('Failed to update license info:', error);
    }
}

// Global state
let vectorStore = null;
let isLoading = false;
let embedder = null;
let CONFIG = null; // Will be loaded from YAML
let xmlData = null; // Parsed XML data for dynamic content loading
let xmlIndex = {}; // curid -> page mapping for fast lookup

// Load configuration from YAML
async function loadConfig(currentSite) {
    try {
        const configPath = `./config.yml`;
        
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        
        const yamlText = await response.text();
        const config = yamlLoad(yamlText);
        
        // Check if we're on a local address and auto_local_path is enabled
        const isLocalAccess = window.location.hostname === '127.0.0.1' || 
                             window.location.hostname === 'localhost' ||
                             window.location.hostname.startsWith('192.168.') ||
                             window.location.hostname.startsWith('10.') ||
                             window.location.hostname.startsWith('172.');
        
        const useLocalPath = config.web.auto_local_path && isLocalAccess;
        const finalPartPathTemplate = useLocalPath ? 
            './vector_store_part{}.json.gz' : 
            config.web.vector_store.part_path_template;
        
        // Map site names to XML file names
        const xmlFileMap = {
            'ja-googology-wiki': 'jagoogology_pages_current.xml.gz',
            'googology-wiki': 'googology_pages_current.xml.gz'
        };
        
        const finalXmlGzPath = useLocalPath ? 
            `./${xmlFileMap[config.web.current_site] || config.web.current_site + '_pages_current.xml.gz'}` : 
            config.web.xml_gz_path;
        
        // Create CONFIG object from YAML
        CONFIG = {
            CURRENT_SITE: config.web.current_site,
            SITE_BASE_URL: config.site.base_url,
            VECTOR_STORE_META_PATH: config.web.vector_store.meta_path,
            VECTOR_STORE_PART_PATH_TEMPLATE: finalPartPathTemplate,
            DEFAULT_TOP_K: config.web.api.default_top_k,
            DEFAULT_API_URL: config.web.api.default_url,
            DEFAULT_MODEL: config.web.api.default_model,
            EMBEDDING_MODEL: config.web.api.embedding_model,
            PRELIMINARY_DOCS_PER_PART: config.vector_store.preliminary_per_part,
            FINAL_RESULT_COUNT: config.vector_store.final_result_count,
            IS_LOCAL_ACCESS: useLocalPath,
            XML_GZ_PATH: finalXmlGzPath || null,
            // Add tokenization configuration
            TOKENIZE_MODE: config.tokenize?.mode || 'normal'
        };
        
        // Store full config for RAG system
        CONFIG.FULL_CONFIG = config;
        
        // Update license information in footer
        updateLicenseInfo(config);
        
        return CONFIG;
    } catch (error) {
        console.error('Failed to load configuration:', error);
        // Fallback to hardcoded config
        CONFIG = {
            CURRENT_SITE: 'googology-wiki',
            SITE_BASE_URL: 'https://googology.fandom.com',
            VECTOR_STORE_META_PATH: 'data/googology-wiki/vector_store_meta.json',
            VECTOR_STORE_PART_PATH_TEMPLATE: 'data/googology-wiki/vector_store_part{}.json.gz',
            DEFAULT_TOP_K: 5,
            DEFAULT_API_URL: 'https://api.openai.com/v1',
            DEFAULT_MODEL: 'gpt-3.5-turbo',
            EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
            PRELIMINARY_DOCS_PER_PART: 10,
            FINAL_RESULT_COUNT: 10
        };
        return CONFIG;
    }
}

// Document chunk merging utilities
function findOverlap(text1, text2, minOverlap = 10, maxOverlap = 300) {
    /**
     * Find overlap between the end of text1 and beginning of text2
     * Returns the length of overlap found, or 0 if no overlap
     */
    const maxCheck = Math.min(maxOverlap, text1.length, text2.length);
    
    for (let len = maxCheck; len >= minOverlap; len--) {
        const text1End = text1.slice(-len);
        const text2Start = text2.slice(0, len);
        
        if (text1End === text2Start) {
            return len;
        }
    }
    
    return 0;
}

function removeOverlap(chunk1Content, chunk2Content) {
    /**
     * Remove overlap between two chunk contents
     * Returns chunk2 with overlap removed, or original chunk2 if no overlap
     */
    try {
        const overlapLen = findOverlap(chunk1Content, chunk2Content);
        if (overlapLen > 0) {
            return chunk2Content.slice(overlapLen);
        }
        return chunk2Content;
    } catch (error) {
        console.warn('Overlap removal failed:', error);
        return chunk2Content;
    }
}

function mergeDocumentChunks(chunks) {
    /**
     * Merge chunks from the same document, removing overlaps
     * Assumes chunks have an 'index' property or are sorted by creation order
     */
    if (!chunks || chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].content;
    
    // Sort chunks by their index in the original document
    // We'll use the chunk's position in the search results as a proxy for document order
    const sortedChunks = [...chunks].sort((a, b) => {
        // If chunks have explicit indices, use them
        if (a.index !== undefined && b.index !== undefined) {
            return a.index - b.index;
        }
        // Otherwise, assume they're already in document order (87.4% of cases)
        return 0;
    });
    
    
    let merged = sortedChunks[0].content;
    let totalOverlapRemoved = 0;
    
    for (let i = 1; i < sortedChunks.length; i++) {
        const prevContent = merged;
        const currentContent = sortedChunks[i].content;
        
        const overlapLen = findOverlap(prevContent, currentContent);
        if (overlapLen > 0) {
            totalOverlapRemoved += overlapLen;
            const deduplicatedContent = currentContent.slice(overlapLen);
            merged += '\n' + deduplicatedContent;
        } else {
            merged += '\n\n' + currentContent;
        }
    }
    
    return merged;
}

function getRepresentativeChunksContext(chunks, representativeChunk, contextSize = DOCUMENT_SIZE_LIMIT / 2) {
    /**
     * Get chunks around the representative chunk within the context size limit
     * Returns merged content centered around the representative chunk
     */
    if (!chunks || chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].content;
    
    // Find the representative chunk in the chunks array
    const repIndex = chunks.findIndex(chunk => 
        chunk.content === representativeChunk.content || 
        chunk.id === representativeChunk.id
    );
    
    if (repIndex === -1) {
        console.warn('Representative chunk not found in chunks array');
        return representativeChunk.content;
    }
    
    // Calculate how much context to take before and after
    const halfContext = Math.floor(contextSize / 2);
    
    // Start with the representative chunk
    let selectedChunks = [chunks[repIndex]];
    let currentSize = chunks[repIndex].content.length;
    
    // Add chunks before the representative chunk
    let beforeSize = 0;
    let beforeIndex = repIndex - 1;
    const beforeChunks = [];
    
    while (beforeIndex >= 0 && beforeSize < halfContext) {
        const chunk = chunks[beforeIndex];
        if (beforeSize + chunk.content.length <= halfContext) {
            beforeChunks.unshift(chunk);
            beforeSize += chunk.content.length;
        } else {
            // Partial chunk - take only what fits
            const remainingSpace = halfContext - beforeSize;
            const partialContent = chunk.content.slice(-remainingSpace);
            beforeChunks.unshift({ ...chunk, content: partialContent });
            beforeSize = halfContext;
        }
        beforeIndex--;
    }
    
    // Add chunks after the representative chunk
    let afterSize = 0;
    let afterIndex = repIndex + 1;
    const afterChunks = [];
    
    while (afterIndex < chunks.length && afterSize < halfContext) {
        const chunk = chunks[afterIndex];
        if (afterSize + chunk.content.length <= halfContext) {
            afterChunks.push(chunk);
            afterSize += chunk.content.length;
        } else {
            // Partial chunk - take only what fits
            const remainingSpace = halfContext - afterSize;
            const partialContent = chunk.content.slice(0, remainingSpace);
            afterChunks.push({ ...chunk, content: partialContent });
            afterSize = halfContext;
        }
        afterIndex++;
    }
    
    // Combine all selected chunks
    selectedChunks = [...beforeChunks, ...selectedChunks, ...afterChunks];
    
    
    // Merge the selected chunks with overlap removal
    return mergeDocumentChunks(selectedChunks);
}

// Convert base64-encoded float32 binary to float array
function base64ToFloat32Array(base64String) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
}

// Vector math utilities
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        console.error('Invalid vectors for cosine similarity:', {
            vecA: vecA ? vecA.length : 'null',
            vecB: vecB ? vecB.length : 'null'
        });
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        const a = vecA[i];
        const b = vecB[i];
        
        if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) {
            console.error(`Invalid vector components at index ${i}:`, { a, b });
            return 0;
        }
        
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0 || isNaN(normA) || isNaN(normB)) {
        console.error('Invalid norms:', { normA, normB });
        return 0;
    }
    
    const similarity = dotProduct / (normA * normB);
    
    if (isNaN(similarity)) {
        console.error('NaN similarity result:', { dotProduct, normA, normB });
        return 0;
    }
    
    return similarity;
}

// Load and parse compressed XML file
async function loadCompressedXML(xmlGzPath, updateProgress) {
    try {
        console.log('Loading compressed XML from:', xmlGzPath);
        updateProgress(0, 'Downloading XML file...');
        
        // Fetch the compressed XML
        const response = await fetch(xmlGzPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch XML: ${response.status}`);
        }
        
        // Get total size for progress tracking
        const contentLength = response.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength) : 0;
        
        // Read as array buffer
        const compressedData = await response.arrayBuffer();
        updateProgress(50, 'Decompressing XML...');
        
        // Decompress using pako
        const decompressed = pako.inflate(new Uint8Array(compressedData));
        const xmlText = new TextDecoder().decode(decompressed);
        
        updateProgress(75, 'Parsing XML...');
        
        // Parse XML
        const parser = new DOMParser();
        xmlData = parser.parseFromString(xmlText, 'text/xml');
        
        // Build index for fast lookup by curid
        const pages = xmlData.getElementsByTagName('page');
        xmlIndex = {};
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const idElement = page.getElementsByTagName('id')[0];
            if (idElement) {
                const curid = idElement.textContent;
                xmlIndex[curid] = page;
            }
        }
        
        updateProgress(100, `XML loaded: ${pages.length} pages indexed`);
        console.log(`XML loaded successfully: ${pages.length} pages, ${(xmlText.length / 1024 / 1024).toFixed(1)} MB`);
        
        return true;
    } catch (error) {
        console.error('Error loading XML:', error);
        throw error;
    }
}

// Get page content from XML by curid
function getPageFromXML(curid) {
    if (!xmlIndex || !xmlIndex[curid]) {
        return null;
    }
    
    const page = xmlIndex[curid];
    const titleElement = page.getElementsByTagName('title')[0];
    const textElement = page.getElementsByTagName('text')[0];
    
    if (!titleElement || !textElement) {
        return null;
    }
    
    return {
        title: titleElement.textContent,
        content: textElement.textContent,
        curid: curid
    };
}

// Extract chunk content from full page text
function extractChunkContent(fullText, chunkStart, chunkEnd) {
    // Ensure valid indices
    if (!fullText || chunkStart < 0 || chunkEnd > fullText.length) {
        return '';
    }
    
    return fullText.substring(chunkStart, chunkEnd);
}

// Test function for URL cleaning - remove this later
function testURLCleaning() {
    const testText = `出典: [http://www.nicovideo.jp/mylist/35451262 巨大数動画シリーズ] (ニコニコ動画) - [http://www.nicovideo.jp/watch/sm19439423 【ゆっくりと学ぶ】グラハム数を解説してみた【再UP版】]

出典: [https://www.nicovideo.jp/watch/sm45062367 きりたんの巨大数解説「原始再帰とグラハム数」]`;

    console.log('Original text:', testText);
    
    // Test the regex pattern
    const pattern = /\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g;
    let match;
    while ((match = pattern.exec(testText)) !== null) {
        console.log('Found match:', match[0], '->', match[1]);
    }
    
    // Test replacement
    const cleaned = testText.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
    console.log('Cleaned text:', cleaned);
    
    return cleaned;
}

// Clean MediaWiki content for LLM prompt generation
function cleanContentForLLM(content) {
    if (!content || typeof content !== 'string') {
        return content;
    }
    
    console.log('=== CONTENT CLEANING STARTED ===');
    console.log('Input content length:', content.length);
    console.log('Content preview:', content.substring(0, 200) + '...');
    
    const originalLength = content.length;
    let cleaned = content;
    
    // Debug: Check if content contains the problematic sections
    const hasRelatedItems = cleaned.includes('== 関連項目 ==');
    const hasReferences = cleaned.includes('== 出典 ==');
    const hasLanguageLinks = /\[\[[a-z]{2}:[^\]]*\]\]/.test(cleaned);
    const hasCategories = /\[\[カテゴリ:[^\]]*\]\]/.test(cleaned);
    const hasExternalLinks = /\[https?:\/\/[^\]]+\]/.test(cleaned);
    const hasInternalLinks = /\[\[[^\]]+\]\]/.test(cleaned);
    
    console.log('Content cleaning - Before:', {
        originalLength,
        hasRelatedItems,
        hasReferences, 
        hasLanguageLinks,
        hasCategories,
        hasExternalLinks,
        hasInternalLinks,
        contentEnd: cleaned.slice(-500)
    });
    
    // 1. Remove MediaWiki file references (high deletion effect)
    cleaned = cleaned.replace(/\[\[ファイル:[^\]]*\]\]/g, '');
    cleaned = cleaned.replace(/\[\[File:[^\]]*\]\]/g, '');
    
    // 2. Remove reference tags (high deletion effect)
    cleaned = cleaned.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
    cleaned = cleaned.replace(/<references\s*\/>/g, '');
    
    // 3. Remove MediaWiki templates (moderate deletion effect)
    cleaned = cleaned.replace(/\{\{[^}]*\}\}/g, '');
    
    // 4. Remove HTML comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // Debug: Check what external links exist before processing
    const externalLinkMatches = cleaned.match(/\[https?:\/\/[^\]]+\]/g);
    if (externalLinkMatches) {
        console.log('Found external links:', externalLinkMatches);
    }
    
    // Handle various formats of external links
    // Main pattern: [http://URL text] or [https://URL text] - extract just the text part
    // Use non-greedy match for URL part, then space(s), then capture text part
    cleaned = cleaned.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, function(match, textPart) {
        console.log('URL link replacement:', match, '->', textPart);
        return textPart;
    });
    // Fallback: Remove any remaining pure URL links without text
    cleaned = cleaned.replace(/\[https?:\/\/[^\]]+\]/g, '');
    
    // Debug: Check what external links remain after processing
    const remainingExternalLinks = cleaned.match(/\[https?:\/\/[^\]]+\]/g);
    if (remainingExternalLinks) {
        console.log('Remaining external links after processing:', remainingExternalLinks);
    }
    
    // 6. Remove language links (they can appear anywhere)
    cleaned = cleaned.replace(/\[\[[a-z]{2}:[^\]]*\]\]/g, '');
    
    // 7. Remove category tags
    cleaned = cleaned.replace(/\[\[カテゴリ:[^\]]*\]\]/g, '');
    cleaned = cleaned.replace(/\[\[Category:[^\]]*\]\]/g, '');
    
    // 8. Remove DEFAULTSORT tags
    cleaned = cleaned.replace(/\{\{DEFAULTSORT:[^}]*\}\}/g, '');
    
    // 9. Remove specific sections that don't contribute to LLM responses
    // Process sections from the end backwards to avoid interference
    
    // Remove "== 出典 ==" section (usually at the end)
    cleaned = cleaned.replace(/== 出典 ==[\s\S]*$/g, '');
    
    // Remove "== 関連項目 ==" section (can be followed by language links)
    cleaned = cleaned.replace(/== 関連項目 ==[\s\S]*?(?=== |$)/g, '');
    
    // Remove "== 動画 ==" section (contains only video links)
    cleaned = cleaned.replace(/== 動画 ==[\s\S]*?(?=== |$)/g, '');
    
    // Clean up any remaining standalone language/category links at the end
    cleaned = cleaned.replace(/\n*\[\[[a-z]{2}:[^\]]*\]\]\s*/g, '');
    cleaned = cleaned.replace(/\n*\[\[カテゴリ:[^\]]*\]\]\s*/g, '');
    cleaned = cleaned.replace(/\n*\[\[Category:[^\]]*\]\]\s*/g, '');
    cleaned = cleaned.replace(/\n*\{\{DEFAULTSORT:[^}]*\}\}\s*/g, '');
    
    // 10. Remove gallery tags
    cleaned = cleaned.replace(/<gallery>[\s\S]*?<\/gallery>/g, '');
    
    // 11. Simplify MediaWiki internal links
    // Replace [[Article|Display Text]] with just Display Text
    cleaned = cleaned.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1');
    // Replace [[Article]] with just Article
    cleaned = cleaned.replace(/\[\[([^\]|]+)\]\]/g, '$1');
    
    // 12. Clean up multiple newlines and whitespace
    cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');
    cleaned = cleaned.replace(/^\s+|\s+$/g, '');
    
    // Debug: Check cleaning results
    const finalLength = cleaned.length;
    const reduction = originalLength - finalLength;
    const stillHasRelatedItems = cleaned.includes('== 関連項目 ==');
    const stillHasReferences = cleaned.includes('== 出典 ==');
    const stillHasLanguageLinks = /\[\[[a-z]{2}:[^\]]*\]\]/.test(cleaned);
    const stillHasCategories = /\[\[カテゴリ:[^\]]*\]\]/.test(cleaned);
    const stillHasExternalLinks = /\[https?:\/\/[^\]]+\]/.test(cleaned);
    const stillHasInternalLinks = /\[\[[^\]]+\]\]/.test(cleaned);
    
    console.log('Content cleaning - After:', {
        finalLength,
        reduction,
        reductionPercent: Math.round((reduction / originalLength) * 100),
        stillHasRelatedItems,
        stillHasReferences,
        stillHasLanguageLinks,
        stillHasCategories,
        stillHasExternalLinks,
        stillHasInternalLinks,
        contentEnd: cleaned.slice(-500)
    });
    
    return cleaned;
}

// Load vector store from multiple compressed JSON parts
async function loadVectorStore(elements) {
    if (isLoading || !embedder) {
        if (!embedder) {
            alert('Embedding model not ready yet. Please wait for initialization.');
        }
        return;
    }
    
    isLoading = true;
    elements.loadDataBtn.disabled = true;
    elements.loadingProgress.classList.add('loading');
    
    // Helper function to update progress bar
    const updateProgress = (current, total) => {
        const percentage = Math.round((current / total) * 100);
        elements.loadingProgress.style.setProperty('--progress', `${percentage}%`);
    };
    
    elements.loadingStatus.textContent = 'Loading metadata...';
    updateProgress(0, 1);
    
    try {
        // First, load metadata
        const metaResponse = await fetch(CONFIG.VECTOR_STORE_META_PATH);
        if (!metaResponse.ok) {
            throw new Error(`Failed to load metadata: ${metaResponse.status}`);
        }
        
        const metadata = await metaResponse.json();
        
        // Load compressed XML file if configured
        if (CONFIG.XML_GZ_PATH) {
            elements.loadingStatus.textContent = 'Loading XML data...';
            updateProgress(1, 10);
            
            try {
                await loadCompressedXML(CONFIG.XML_GZ_PATH, (progress, status) => {
                    updateProgress(1 + progress / 100, 10);
                    elements.loadingStatus.textContent = status;
                });
            } catch (error) {
                console.warn('Failed to load XML data:', error);
                // Continue without XML - will use embedded content from vector store
            }
        }
        
        // Load all parts
        const parts = [];
        let titleParts = [];
        const totalSteps = metadata.num_parts;
        
        for (let partIndex = 1; partIndex <= metadata.num_parts; partIndex++) {
            const loadingMessage = CONFIG.IS_LOCAL_ACCESS ? 
                `Loading part ${partIndex}/${metadata.num_parts} by local...` :
                `Loading part ${partIndex}/${metadata.num_parts}...`;
            elements.loadingStatus.textContent = loadingMessage;
            
            const partPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE.replace('{}', String(partIndex).padStart(2, '0'));
            
            const response = await fetch(partPath);
            if (!response.ok) {
                throw new Error(`Failed to load part ${partIndex}: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
            const partData = JSON.parse(decompressed);
            
            parts.push(partData);
            
            // Update progress bar
            updateProgress(partIndex, totalSteps);
        }
        
        // Try to load title vector store metadata and parts
        try {
            const titleMetaPath = CONFIG.VECTOR_STORE_META_PATH.replace('vector_store_meta.json', 'vector_store_titles_meta.json');
            const titleMetaResponse = await fetch(titleMetaPath);
            
            if (titleMetaResponse.ok) {
                const titleMetadata = await titleMetaResponse.json();
                elements.loadingStatus.textContent = `Loading title vector store (${titleMetadata.num_parts} parts)...`;
                
                // Load title parts in parallel for better performance
                const titleLoadPromises = [];
                for (let partIndex = 1; partIndex <= titleMetadata.num_parts; partIndex++) {
                    const titlePartPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE
                        .replace('vector_store_part', 'vector_store_titles_part')
                        .replace('{}', String(partIndex).padStart(2, '0'));
                    
                    const loadPromise = fetch(titlePartPath)
                        .then(response => {
                            if (response.ok) {
                                return response.arrayBuffer();
                            }
                            throw new Error(`Failed to load title part ${partIndex}`);
                        })
                        .then(arrayBuffer => {
                            const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
                            return JSON.parse(decompressed);
                        })
                        .catch(error => {
                            console.warn(`Failed to load title part ${partIndex}:`, error);
                            return null;
                        });
                    
                    titleLoadPromises.push(loadPromise);
                }
                
                // Wait for all title parts to load
                const titleResults = await Promise.all(titleLoadPromises);
                titleParts = titleResults.filter(part => part !== null);
                
                if (titleParts.length > 0) {
                    console.log(`✓ Loaded ${titleParts.length}/${titleMetadata.num_parts} title vector store parts`);
                }
            }
        } catch (error) {
            console.warn('Title vector store not available, using fallback search:', error);
        }
        
        // PCA model for title transformations is currently disabled
        // (Client-side PCA implementation not available)
        let pcaModel = null;

        // Create vector store object with preliminary-final search functionality
        vectorStore = {
            parts: parts,
            titleParts: titleParts,
            pcaModel: pcaModel,
            metadata: metadata,
            totalDocuments: metadata.total_documents,
            embeddingDimension: metadata.embedding_dimension,
            config: CONFIG.FULL_CONFIG,  // Add full config for tokenization
            
            search: async function(query, k = CONFIG.FINAL_RESULT_COUNT) {
                if (!embedder) {
                    throw new Error('Embedder not initialized');
                }
                
                // Tokenize query for Japanese morphological analysis
                let tokenizedQuery = query;
                console.log('Tokenization check:', {
                    configExists: !!this.config,
                    configTokenize: this.config?.tokenize,
                    configTokenizeMode: this.config?.tokenize?.mode,
                    isMecabMode: this.config?.tokenize?.mode === 'mecab',
                    originalQuery: query,
                    fullConfig: this.config
                });
                
                if (this.config?.tokenize?.mode === 'mecab' || this.config?.tokenize?.mode === 'tinysegmenter') {
                    console.log(`🔤 ${this.config.tokenize.mode} mode enabled, initializing morphological analyzer...`);
                    await japaneseMorphAnalyzer.initialize();
                    tokenizedQuery = japaneseMorphAnalyzer.tokenize(query);
                    console.log('🔤 Query tokenization result:', {
                        original: query,
                        tokenized: tokenizedQuery
                    });
                } else {
                    console.log('🔤 Normal mode, skipping tokenization');
                }
                
                // Get query embedding
                const output = await embedder(tokenizedQuery, { pooling: 'mean', normalize: true });
                const queryEmbedding = Array.from(output.data);
                
                // Phase 0: Title-based document selection (optimized)
                const titleResults = await this.searchByTitle(queryEmbedding, 10);
                
                // Phase 1: Preliminary search in each part (optimized parallel processing)
                const preliminaryResults = [];
                
                // Process parts in parallel for better performance
                const partSearchPromises = this.parts.map(async (part, partIndex) => {
                    const partSimilarities = [];
                    
                    // Search in this part
                    for (let docIndex = 0; docIndex < part.documents.length; docIndex++) {
                        const doc = part.documents[docIndex];
                        
                        // Handle both binary and array formats
                        let embedding;
                        if (doc.embedding_binary && doc.embedding_format === 'float32_base64') {
                            embedding = Array.from(base64ToFloat32Array(doc.embedding_binary));
                        } else if (doc.embedding && Array.isArray(doc.embedding)) {
                            embedding = doc.embedding;
                        } else {
                            continue;
                        }
                        
                        const similarity = cosineSimilarity(queryEmbedding, embedding);
                        if (!isNaN(similarity)) {
                            partSimilarities.push({
                                id: doc.id,
                                content: doc.content,
                                metadata: doc.metadata,
                                curid: doc.curid,  // Include curid for XML content lookup
                                score: similarity,
                                partIndex: partIndex
                            });
                        }
                    }
                    
                    // Get top preliminary results from this part
                    partSimilarities.sort((a, b) => b.score - a.score);
                    return partSimilarities.slice(0, CONFIG.PRELIMINARY_DOCS_PER_PART);
                });
                
                // Wait for all parts to complete and combine results
                const partResults = await Promise.all(partSearchPromises);
                for (const partResult of partResults) {
                    preliminaryResults.push(...partResult);
                }
                
                // Phase 2: Final ranking of all preliminary results
                preliminaryResults.sort((a, b) => b.score - a.score);
                const finalResults = preliminaryResults.slice(0, k);
                
                // Enrich results with content from XML if available
                console.log(`XML data available: ${!!xmlData}, Processing ${finalResults.length} results`);
                const enrichedResults = finalResults.map(doc => {
                    console.log(`Processing doc:`, { curid: doc.curid, id: doc.id, hasXmlData: !!xmlData });
                    if (xmlData && doc.curid) {
                        const pageData = getPageFromXML(doc.curid);
                        if (pageData) {
                            console.log(`XML data found for curid ${doc.curid}: "${pageData.title}"`);
                            console.log(`Full page content length: ${pageData.content.length}`);
                            console.log(`Content preview:`, pageData.content.substring(0, 200) + '...');
                            // For chunks, check document size and provide appropriate content
                            if (doc.chunk_index !== undefined && doc.chunk_start !== undefined && doc.chunk_end !== undefined) {
                                let content;
                                
                                console.log(`Processing chunk for "${pageData.title}":`, {
                                    fullContentLength: pageData.content.length,
                                    chunkStart: doc.chunk_start,
                                    chunkEnd: doc.chunk_end,
                                    curid: doc.curid
                                });
                                
                                // If document is small enough, use full content
                                if (pageData.content.length <= DOCUMENT_SIZE_LIMIT) {
                                    content = pageData.content;
                                    console.log(`Using full content for "${pageData.title}" (${pageData.content.length} chars)`);
                                } else {
                                    // For large documents, provide context around the chunk
                                    const chunkStart = Math.max(0, doc.chunk_start);
                                    const chunkEnd = Math.min(pageData.content.length, doc.chunk_end);
                                    
                                    // Calculate context window around the chunk
                                    const contextBefore = Math.max(0, chunkStart - 500);
                                    const contextAfter = Math.min(pageData.content.length, chunkEnd + 500);
                                    
                                    content = pageData.content.substring(contextBefore, contextAfter);
                                    
                                    // Add ellipsis if truncated
                                    if (contextBefore > 0) content = '...' + content;
                                    if (contextAfter < pageData.content.length) content = content + '...';
                                    
                                    console.log(`Using context window for "${pageData.title}" (${content.length} chars from ${contextBefore}-${contextAfter})`);
                                }
                                
                                return {
                                    ...doc,
                                    content: content,
                                    title: pageData.title,
                                    metadata: {
                                        ...doc.metadata,
                                        title: pageData.title,
                                        curid: doc.curid
                                    }
                                };
                            } else {
                                // For title-based results, use full content
                                console.log(`Processing title-based result for "${pageData.title}":`, {
                                    fullContentLength: pageData.content.length,
                                    curid: doc.curid,
                                    contentPreview: pageData.content.substring(0, 100) + '...'
                                });
                                
                                return {
                                    ...doc,
                                    content: pageData.content,
                                    title: pageData.title,
                                    metadata: {
                                        ...doc.metadata,
                                        title: pageData.title,
                                        curid: doc.curid
                                    }
                                };
                            }
                        }
                    }
                    // Fallback: if no XML data or page not found, use embedded content if available
                    return doc;
                });
                
                // Apply document grouping if enabled
                let processedResults;
                if (GROUP_BY_DOCUMENT) {
                    
                    // Group chunks by document ID
                    const documentGroups = new Map();
                    
                    for (const doc of enrichedResults) {
                        const docId = doc.metadata ? doc.metadata.id : doc.id;
                        
                        if (!documentGroups.has(docId)) {
                            documentGroups.set(docId, {
                                bestChunk: doc,
                                maxScore: doc.score,
                                title: doc.metadata ? doc.metadata.title : 'Unknown',
                                allChunks: [doc]
                            });
                        } else {
                            const group = documentGroups.get(docId);
                            group.allChunks.push(doc);
                            
                            // Update best chunk if this one has higher score
                            if (doc.score > group.maxScore) {
                                group.bestChunk = doc;
                                group.maxScore = doc.score;
                            }
                        }
                    }
                    
                    // Convert to array and sort by max score
                    const documentArray = Array.from(documentGroups.values());
                    documentArray.sort((a, b) => b.maxScore - a.maxScore);
                    
                    // Take top 10 documents
                    processedResults = documentArray.slice(0, 10);
                } else {
                    // Use original chunk-based results
                    processedResults = finalResults;
                }
                
                // Format results
                const formattedResults = processedResults.map(item => {
                    let doc, docScore, docContent;
                    
                    if (GROUP_BY_DOCUMENT) {
                        // Use best chunk as representative
                        doc = item.bestChunk;
                        docScore = item.maxScore;
                        docContent = doc.content; // Use representative chunk content
                    } else {
                        // Use chunk directly
                        doc = item;
                        docScore = doc.score;
                        docContent = doc.content;
                    }
                    
                    // Try to get curid from different sources
                    const curid = doc.curid || doc.metadata?.curid || doc.metadata?.id;
                    
                    // Generate curid-based URL for reliable access
                    let url = '#';
                    const pageId = curid || doc.metadata?.id || doc.id;
                    
                    if (curid && curid.match(/^\d+$/)) {
                        // If curid is numeric, create proper wiki URL
                        url = `${this.config?.site?.base_url || 'https://googology.fandom.com/ja'}/?curid=${curid}`;
                    } else if (doc.metadata && doc.metadata.url) {
                        // Fallback to original URL if curid is not available
                        url = doc.metadata.url;
                    }
                    
                    return {
                        title: doc.metadata?.title || 'Unknown',
                        content: docContent,
                        score: docScore,
                        url: url,
                        id: pageId,
                        curid: curid,  // Add curid field
                        isDocumentGroup: GROUP_BY_DOCUMENT,
                        chunkCount: GROUP_BY_DOCUMENT ? item.allChunks.length : 1,
                        allChunks: GROUP_BY_DOCUMENT ? item.allChunks : [doc]
                    };
                });
                
                return {
                    bodyResults: formattedResults,
                    titleResults: titleResults
                };
            },
            
            searchByTitle: async function(queryEmbedding, k = 10) {
                const titleSimilarities = [];
                
                // Use pre-computed title vector store if available (optimized)
                if (this.titleParts && this.titleParts.length > 0) {
                    // Search pre-computed title embeddings with deduplication
                    const seenDocuments = new Set();
                    
                    for (let partIndex = 0; partIndex < this.titleParts.length; partIndex++) {
                        const titlePart = this.titleParts[partIndex];
                        
                        for (let docIndex = 0; docIndex < titlePart.documents.length; docIndex++) {
                            const doc = titlePart.documents[docIndex];
                            
                            // Handle both binary and array formats
                            let embedding;
                            if (doc.embedding_binary && doc.embedding_format === 'float32_base64') {
                                embedding = Array.from(base64ToFloat32Array(doc.embedding_binary));
                            } else if (doc.embedding && Array.isArray(doc.embedding)) {
                                embedding = doc.embedding;
                            } else {
                                continue;
                            }
                            
                            const docId = doc.metadata ? doc.metadata.id : doc.id;
                            if (seenDocuments.has(docId)) {
                                continue; // Skip duplicates
                            }
                            seenDocuments.add(docId);
                            
                            const titleSimilarity = cosineSimilarity(queryEmbedding, embedding);
                            
                            
                            if (!isNaN(titleSimilarity)) {
                                titleSimilarities.push({
                                    id: doc.id,
                                    content: doc.content,
                                    metadata: doc.metadata,
                                    curid: doc.curid,  // Include curid for XML content lookup
                                    score: titleSimilarity,
                                    partIndex: partIndex
                                });
                            }
                        }
                    }
                } else {
                    // Fallback to real-time title embedding (slower)
                    for (let partIndex = 0; partIndex < this.parts.length; partIndex++) {
                        const part = this.parts[partIndex];
                        
                        for (let docIndex = 0; docIndex < part.documents.length; docIndex++) {
                            const doc = part.documents[docIndex];
                            if (!doc.embedding || !Array.isArray(doc.embedding) || !doc.metadata || !doc.metadata.title) {
                                continue;
                            }
                            
                            // Calculate title similarity by embedding the title
                            const titleOutput = await embedder(doc.metadata.title, { pooling: 'mean', normalize: true });
                            const titleEmbedding = Array.from(titleOutput.data);
                            const titleSimilarity = cosineSimilarity(queryEmbedding, titleEmbedding);
                            
                            if (!isNaN(titleSimilarity)) {
                                const docId = doc.metadata ? doc.metadata.id : doc.id;
                                
                                // Check if we already have this document (avoid duplicates)
                                const existingIndex = titleSimilarities.findIndex(item => 
                                    (item.metadata ? item.metadata.id : item.id) === docId
                                );
                                
                                if (existingIndex === -1) {
                                    titleSimilarities.push({
                                        id: doc.id,
                                        content: doc.content,
                                        metadata: doc.metadata,
                                        curid: doc.curid,  // Include curid for XML content lookup
                                        score: titleSimilarity,
                                        partIndex: partIndex
                                    });
                                } else if (titleSimilarity > titleSimilarities[existingIndex].score) {
                                    // Replace with higher scoring chunk from same document
                                    titleSimilarities[existingIndex] = {
                                        id: doc.id,
                                        content: doc.content,
                                        metadata: doc.metadata,
                                        curid: doc.curid,  // Include curid for XML content lookup
                                        score: titleSimilarity,
                                        partIndex: partIndex
                                    };
                                }
                            }
                        }
                    }
                }
                
                // Sort by title similarity and take top k
                titleSimilarities.sort((a, b) => b.score - a.score);
                const topTitleResults = titleSimilarities.slice(0, k);
                
                // Format title results similar to body results with XML content enrichment
                return topTitleResults.map(doc => {
                    let content = doc.content; // Default to vector store content
                    let enrichedWithXML = false;
                    
                    console.log(`Processing title result:`, { 
                        id: doc.id, 
                        curid: doc.curid, 
                        metadataId: doc.metadata?.id,
                        title: doc.metadata?.title,
                        hasXmlData: !!xmlData,
                        originalContentLength: doc.content?.length || 0,
                        originalContent: (doc.content?.substring(0, 50) || 'No content') + '...'
                    });
                    
                    // Try to get curid from different sources
                    const curid = doc.curid || doc.metadata?.curid || doc.metadata?.id;
                    
                    // Enrich with XML content if available
                    if (xmlData && curid) {
                        const pageData = getPageFromXML(curid);
                        if (pageData) {
                            console.log(`Title result XML data found for curid ${curid}: "${pageData.title}"`);
                            console.log(`Title result full page content length: ${pageData.content.length}`);
                            console.log(`Title result content preview: ${pageData.content.substring(0, 100)}...`);
                            content = pageData.content; // Use full XML content for title results
                            enrichedWithXML = true;
                            console.log(`Successfully enriched title result with XML content: ${content.length} chars`);
                        } else {
                            console.log(`No XML page data found for curid ${curid}`);
                        }
                    } else {
                        console.log(`Cannot enrich title result: xmlData=${!!xmlData}, curid=${curid}`);
                    }
                    
                    // Generate curid-based URL for reliable access
                    let url = '#';
                    const pageId = curid || doc.metadata?.id || doc.id;
                    
                    if (curid && curid.match(/^\d+$/)) {
                        // If curid is numeric, create proper wiki URL
                        url = `${this.config?.site?.base_url || 'https://googology.fandom.com/ja'}/?curid=${curid}`;
                    } else if (doc.metadata && doc.metadata.url) {
                        // Fallback to original URL if curid is not available
                        url = doc.metadata.url;
                    }
                    
                    // Get pageData if available, otherwise undefined
                    let pageDataForTitle = null;
                    if (xmlData && curid) {
                        pageDataForTitle = getPageFromXML(curid);
                    }
                    
                    const result = {
                        title: doc.metadata?.title || pageDataForTitle?.title || 'Unknown',
                        content: content,
                        score: doc.score,
                        url: url,
                        id: pageId,
                        curid: curid,  // Add curid field
                        isDocumentGroup: false,
                        chunkCount: 1,
                        allChunks: [doc]
                    };
                    
                    console.log(`Returning title result:`, {
                        title: result.title,
                        contentLength: result.content.length,
                        enrichedWithXML: enrichedWithXML,
                        contentPreview: result.content.substring(0, 100) + '...'
                    });
                    
                    return result;
                });
            }
        };
        
        elements.loadingStatus.textContent = 'Data loaded successfully';
        
        // Update error messages after vector store is loaded
        checkAndShowErrors(elements);
        
    } catch (error) {
        console.error('Error loading vector store:', error);
        elements.loadingStatus.textContent = 'Failed to load data: ' + error.message;
        elements.loadingProgress.classList.remove('loading');
    } finally {
        isLoading = false;
        elements.loadDataBtn.disabled = false;
    }
}

// Error message management
function showErrorMessages(elements, messages) {
    elements.errorMessages.innerHTML = messages
        .map(msg => `<div class="error-message">${msg}</div>`)
        .join('');
}

function clearErrorMessages(elements) {
    elements.errorMessages.innerHTML = '';
}

// Check and display error messages continuously
function checkAndShowErrors(elements) {
    const errors = [];
    
    // Check API settings
    const baseUrl = elements.baseUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();
    
    
    if (!baseUrl || !apiKey) {
        errors.push('上記の設定でLLM API設定を行ってください');
    }
    
    // Check vector store
    if (!vectorStore) {
        errors.push('上記の設定でデータを読み込んでください');
    }
    
    // Show or clear error messages
    if (errors.length > 0) {
        showErrorMessages(elements, errors);
        elements.sendBtn.disabled = true;
    } else {
        clearErrorMessages(elements);
        elements.sendBtn.disabled = false;
    }
}

// Handle send button click
function handleSend(elements) {
    const query = elements.promptWindow.value.trim();
    if (!query) return;
    
    // Save query to localStorage for next page load
    try {
        localStorage.setItem('lastQuery', query);
    } catch (error) {
        console.warn('Could not save query to localStorage:', error);
    }
    
    // Show immediate feedback and disable inputs
    elements.responseWindow.innerHTML = '<div class="loading-spinner"></div> Searching and generating response...';
    elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Searching documents...';
    elements.sendBtn.disabled = true;
    elements.promptWindow.disabled = true;
    
    // Queue the actual processing using setTimeout to ensure UI updates immediately
    setTimeout(() => {
        processSearchAndResponse(elements, query);
    }, 0);
}

// Actual processing function
async function processSearchAndResponse(elements, query) {
    // At this point, all validations should already pass since send button is only enabled when ready
    const apiKey = elements.apiKey.value.trim();
    
    try {
        // Search vector store using HuggingFace embeddings
        const searchResults = await vectorStore.search(query);
        
        displayRAGResults(elements, searchResults.bodyResults, searchResults.titleResults);
        
        // Generate AI response using OpenAI LLM
        await generateAIResponse(elements, query, searchResults.bodyResults, searchResults.titleResults, apiKey);
        
    } catch (error) {
        console.error('Error during search:', error);
        elements.responseWindow.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        elements.ragWindow.innerHTML = `<p class="error">Search failed: ${error.message}</p>`;
    } finally {
        elements.promptWindow.disabled = false;
        // Re-check errors to restore correct send button state
        checkAndShowErrors(elements);
    }
}

// Display RAG search results
function displayRAGResults(elements, bodyResults, titleResults) {
    if ((!bodyResults || bodyResults.length === 0) && (!titleResults || titleResults.length === 0)) {
        elements.ragWindow.innerHTML = '<p class="no-results">No relevant documents found.</p>';
        return;
    }
    
    let resultsHTML = '';
    let citationNumber = 1;
    
    // Display title-based results first (starting from 1)
    if (titleResults && titleResults.length > 0) {
        const titleHTML = titleResults.map((result, index) => {
            const refNumber = citationNumber++;
            let scoreText = `Score: ${result.score.toFixed(4)} | curid: ${result.curid || result.id}`;
            
            // Clean content for display
            const cleanedContent = cleanContentForLLM(result.content);
            
            return `
            <div class="rag-result">
                <div class="result-header">
                    <span class="result-number">[${refNumber}]</span>
                    <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                    <span class="result-score">${scoreText}</span>
                </div>
                <div class="result-content">
                    ${SHOW_FULL_RAG_CONTENT ? cleanedContent : 
                      (cleanedContent.substring(0, 300) + (cleanedContent.length > 300 ? '...' : ''))}
                </div>
            </div>
            `;
        }).join('');
        
        resultsHTML += `<h3>RAG Search Results (titles)</h3>${titleHTML}`;
    }
    
    // Display body-based results (continuing the numbering)
    if (bodyResults && bodyResults.length > 0) {
        const bodyHTML = bodyResults.map((result, index) => {
            const refNumber = citationNumber++;
            let scoreText = `Score: ${result.score.toFixed(4)} | curid: ${result.curid || result.id}`;
            
            // Add chunk count information for document grouping
            if (result.isDocumentGroup && result.chunkCount > 1) {
                scoreText += ` | ${result.chunkCount} chunks`;
            }
            
            // Clean content for display
            const cleanedContent = cleanContentForLLM(result.content);
            
            return `
            <div class="rag-result">
                <div class="result-header">
                    <span class="result-number">[${refNumber}]</span>
                    <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                    <span class="result-score">${scoreText}</span>
                </div>
                <div class="result-content">
                    ${SHOW_FULL_RAG_CONTENT ? cleanedContent : 
                      (cleanedContent.substring(0, 300) + (cleanedContent.length > 300 ? '...' : ''))}
                </div>
            </div>
            `;
        }).join('');
        
        resultsHTML += `<h3>RAG Search Results (body)</h3>${bodyHTML}`;
    }
    
    elements.ragWindow.innerHTML = resultsHTML;
}

// Display LLM prompt in dedicated debug section
function displayLLMPrompt(systemPrompt, userQuery) {
    const debugSection = document.getElementById('llm-prompt-debug-section');
    const systemPromptContent = document.getElementById('system-prompt-content');
    const userQueryContent = document.getElementById('user-query-content');
    
    if (SHOW_LLM_PROMPT && debugSection && systemPromptContent && userQueryContent) {
        systemPromptContent.textContent = systemPrompt;
        userQueryContent.textContent = userQuery;
        debugSection.style.display = 'block';
    } else if (debugSection) {
        debugSection.style.display = 'none';
    }
}

// Generate AI response using OpenAI API
async function generateAIResponse(elements, query, bodyResults, titleResults, apiKey) {
    let promptSizeWarning = '';
    
    try {
        const baseUrl = elements.baseUrl.value.trim();
        
        // Create numbered references for citations (same order as display)
        let citationNumber = 1;
        const citations = [];
        
        console.log('Citation system: Processing results for citations');
        console.log('Title results count:', titleResults.length);
        console.log('Body results count:', bodyResults.length);
        
        // Create context from title results first (starting from 1)
        const titleContext = titleResults.map(result => {
            const refNumber = citationNumber++;
            citations.push({
                number: refNumber,
                title: result.title,
                url: result.url,
                type: 'title'
            });
            
            console.log(`Citation [${refNumber}] added:`, result.title);
            console.log(`[${refNumber}] Title content: "${result.content}" (${result.content.length} chars)`);
            
            // Clean content for LLM prompt
            const cleanedContent = cleanContentForLLM(result.content);
            console.log(`[${refNumber}] Title content after cleaning: ${cleanedContent.length} chars (reduced by ${result.content.length - cleanedContent.length})`);
            
            return `[${refNumber}] **${result.title}**\n${cleanedContent}`;
        }).join('\n\n');
        
        // Create context from body results (continuing the numbering)
        const bodyContext = bodyResults.map(result => {
            const refNumber = citationNumber++;
            citations.push({
                number: refNumber,
                title: result.title,
                url: result.url,
                type: 'body'
            });
            
            console.log(`Citation [${refNumber}] added:`, result.title);
            
            let rawContent;
            if (result.isDocumentGroup && result.allChunks && result.allChunks.length > 1) {
                // For document groups, check total size first
                const estimatedSize = result.allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
                
                console.log(`[${refNumber}] Document "${result.title}": ${result.allChunks.length} chunks, estimated size: ${estimatedSize} chars`);
                
                if (estimatedSize > DOCUMENT_SIZE_LIMIT) {
                    // Document too large - use representative chunk context
                    rawContent = getRepresentativeChunksContext(result.allChunks, result, DOCUMENT_SIZE_LIMIT / 2);
                    console.log(`[${refNumber}] Used representative chunks, result size: ${rawContent.length} chars`);
                } else {
                    // Document within limit - merge all chunks
                    rawContent = mergeDocumentChunks(result.allChunks);
                    console.log(`[${refNumber}] Merged all chunks, result size: ${rawContent.length} chars`);
                }
            } else {
                // For single chunks, use original format
                console.log(`[${refNumber}] Single chunk "${result.title}": ${result.content?.length || 0} chars`);
                rawContent = result.content || 'No content available';
            }
            
            // Clean content for LLM prompt
            const cleanedContent = cleanContentForLLM(rawContent);
            console.log(`[${refNumber}] Body content after cleaning: ${cleanedContent.length} chars (reduced by ${rawContent.length - cleanedContent.length})`);
            
            return `[${refNumber}] **${result.title}**\n${cleanedContent}`;
        }).join('\n\n');
        
        // Combine both contexts
        let combinedContext = '';
        if (titleResults.length > 0) {
            combinedContext += 'Title-based relevant documents:\n' + titleContext;
        }
        if (bodyResults.length > 0) {
            if (combinedContext) combinedContext += '\n\n';
            combinedContext += 'Content-based relevant documents:\n' + bodyContext;
        }
        
        const systemPrompt = `You are a helpful assistant that answers questions about googology using the provided context from the Googology Wiki. 

Please provide detailed and informative answers based strictly on the provided context. Explain concepts clearly and include relevant definitions, examples, and background information when available in the context. Structure your response in a logical manner.

LANGUAGE REQUIREMENTS:
- Respond in the same language as the user's question
- If the user asks in Japanese, respond in Japanese
- If the user asks in English, respond in English
- If the user asks in any other language, respond in that language
- Maintain technical accuracy while using natural language appropriate to the user's language

CRITICAL CITATION REQUIREMENTS:
- You MUST cite sources for ALL factual claims and information using the provided reference numbers in square brackets (e.g., [1], [2], [3])
- Each source document in the context is numbered with [1], [2], etc. - use these exact numbers
- Place citations immediately after the relevant information: "Graham's number is extremely large [1]" not "Graham's number is extremely large. [1]"
- Use multiple citations when information comes from multiple sources: "This concept appears in several contexts [1][3][5]"
- Do NOT provide information without proper citations - if you cannot cite it, do not include it

Use the following context to answer the user's question. The context includes both title-based and content-based search results. If the context doesn't contain enough information to answer the question completely, clearly state what information is missing and provide what you can based on the available context. Do not make assumptions or add information not present in the provided context.

You can use LaTeX math notation in your responses - inline math with $...$ and display math with $$...$$ - as MathJax will render it properly.

Context from Googology Wiki:
${combinedContext}`;

        console.log('Citation system: Generated system prompt with', citations.length, 'citations');
        console.log('Citation system: Combined context length:', combinedContext.length, 'characters');
        
        // Check prompt size limit and truncate if necessary
        const totalPromptSize = systemPrompt.length + query.length;
        console.log('Prompt size check:', {
            systemPromptLength: systemPrompt.length,
            queryLength: query.length,
            totalSize: totalPromptSize,
            limit: PROMPT_SIZE_LIMIT,
            withinLimit: totalPromptSize <= PROMPT_SIZE_LIMIT
        });
        
        if (totalPromptSize > PROMPT_SIZE_LIMIT) {
            promptSizeWarning = ` Warning: Prompt size (${totalPromptSize}) exceeds limit (${PROMPT_SIZE_LIMIT}). OpenAI will likely reject this with Error 400.`;
            console.warn(`Prompt size (${totalPromptSize}) exceeds limit (${PROMPT_SIZE_LIMIT}). OpenAI will likely reject this with Error 400.`);
            // Note: We continue with the full context but log the warning.
            // The cleaning should have reduced the size significantly.
        }
        
        // Display LLM prompt in debug section
        displayLLMPrompt(systemPrompt, query);
        
        // Debug: Log the first 500 characters of the context to verify citation numbers are included
        if (combinedContext.length > 0) {
            console.log('Citation system: Context preview:', combinedContext.substring(0, 500) + '...');
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.DEFAULT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
                max_tokens: 3000
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Display the response
        let responseHTML = `<div class="ai-response">${aiResponse.replace(/\n/g, '<br>')}</div>`;
        
        // Set response content and trigger MathJax rendering
        elements.responseWindow.innerHTML = responseHTML;
        
        // Re-display RAG results to include LLM prompt if debug flag is enabled
        displayRAGResults(elements, bodyResults, titleResults);
        
        // Re-render MathJax for the new content
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([elements.responseWindow]).catch((err) => {
                console.warn('MathJax rendering error:', err);
            });
        } else if (window.MathJax && window.MathJax.Hub) {
            // Fallback for older MathJax versions
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, elements.responseWindow]);
        } else {
            console.warn('MathJax not properly initialized or typesetPromise unavailable');
            console.log('MathJax status:', {
                exists: !!window.MathJax,
                typesetPromise: !!(window.MathJax && window.MathJax.typesetPromise),
                Hub: !!(window.MathJax && window.MathJax.Hub),
                startup: !!(window.MathJax && window.MathJax.startup)
            });
        }
        
    } catch (error) {
        console.error('Error generating AI response:', error);
        elements.responseWindow.innerHTML = `<p class="error">Failed to generate response: ${error.message}${promptSizeWarning}</p>`;
    }
}

// Initialize RAG system with given currentSite
async function initializeRAG(currentSite) {
    // Get DOM elements
    const elements = {
        baseUrl: document.getElementById('base-url'),
        apiKey: document.getElementById('api-key'),
        loadDataBtn: document.getElementById('load-data-btn'),
        loadingProgress: document.getElementById('loading-progress'),
        loadingStatus: document.getElementById('loading-status'),
        promptWindow: document.getElementById('prompt-window'),
        sendBtn: document.getElementById('send-btn'),
        responseWindow: document.getElementById('response-window'),
        ragWindow: document.getElementById('rag-window'),
        errorMessages: document.getElementById('error-messages')
    };
    
    // Load configuration first
    await loadConfig(currentSite);
    
    // Set default API URL
    elements.baseUrl.value = CONFIG.DEFAULT_API_URL;
    
    // Initialize the embedding pipeline for retrieval
    elements.loadingStatus.textContent = 'Initializing embedding model...';
    
    try {
        embedder = await pipeline('feature-extraction', CONFIG.EMBEDDING_MODEL);
        
        // Try to load metadata to show file sizes
        try {
            const metaResponse = await fetch('./vector_store_meta.json');
            if (metaResponse.ok) {
                const metadata = await metaResponse.json();
                if (metadata.total_gz_size_mb && metadata.total_json_size_mb) {
                    elements.loadingStatus.textContent = `Download ${Math.round(metadata.total_gz_size_mb)}MB, Memory ${Math.round(metadata.total_json_size_mb)}MB`;
                } else {
                    elements.loadingStatus.textContent = 'Embedding model ready - click "Load Data"';
                }
            } else {
                elements.loadingStatus.textContent = 'Embedding model ready - click "Load Data"';
            }
        } catch (error) {
            console.warn('Could not load metadata for size info:', error);
            elements.loadingStatus.textContent = 'Embedding model ready - click "Load Data"';
        }
    } catch (error) {
        console.error('Failed to initialize embedding pipeline:', error);
        elements.loadingStatus.textContent = 'Failed to initialize embedding model';
    }
    
    // Event listeners
    elements.loadDataBtn.addEventListener('click', () => loadVectorStore(elements));
    elements.sendBtn.addEventListener('click', () => handleSend(elements));
    elements.promptWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !elements.sendBtn.disabled) {
            handleSend(elements);
        }
    });
    
    // Listen for input changes to update error messages
    elements.baseUrl.addEventListener('input', () => checkAndShowErrors(elements));
    elements.apiKey.addEventListener('input', () => checkAndShowErrors(elements));
    
    // Restore last query from localStorage
    try {
        const lastQuery = localStorage.getItem('lastQuery');
        if (lastQuery && lastQuery.trim()) {
            elements.promptWindow.value = lastQuery;
            console.log('Restored last query from localStorage:', lastQuery);
        }
    } catch (error) {
        console.warn('Could not restore query from localStorage:', error);
    }
    
    // Single delayed check for initial error display
    setTimeout(() => {
        checkAndShowErrors(elements);
    }, 1000);
}

// Export the initialization function
export { initializeRAG, testURLCleaning };
