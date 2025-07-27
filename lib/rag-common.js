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

// Extract token limit from OpenAI error messages
function extractTokenLimitFromError(errorResponse) {
    try {
        // Handle both string and object inputs
        let errorData;
        if (typeof errorResponse === 'string') {
            try {
                errorData = JSON.parse(errorResponse);
            } catch (e) {
                // If not JSON, treat as plain text
                errorData = { message: errorResponse };
            }
        } else if (typeof errorResponse === 'object') {
            errorData = errorResponse;
        } else {
            return null;
        }
        
        // Extract from structured OpenAI error response
        let messageText = '';
        if (errorData.error && errorData.error.message) {
            messageText = errorData.error.message;
        } else if (errorData.message) {
            messageText = errorData.message;
        } else {
            return null;
        }
        
        console.log('🔍 Extracting token limit from message:', messageText);
        
        // Pattern to match OpenAI's actual error format: "maximum context length is X tokens"
        const patterns = [
            /maximum context length is (\d+) tokens/i,
            /context length is (\d+) tokens/i,
            /exceeds the maximum (\d+) tokens/i,
            /token limit (?:of )?(\d+)/i,
            /(\d+) tokens? limit/i
        ];
        
        for (const pattern of patterns) {
            const match = messageText.match(pattern);
            if (match && match[1]) {
                const tokenLimit = parseInt(match[1], 10);
                if (tokenLimit > 0) {
                    // Convert tokens to approximate characters (1 token ≈ 3.5 characters, conservative)
                    const charLimit = Math.floor(tokenLimit * 3.5);
                    console.log(`🔍 Extracted token limit: ${tokenLimit} tokens → ${charLimit} chars`);
                    return charLimit;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.log('🔍 Error extracting token limit:', error);
        return null;
    }
}

// OpenAI model limits (tokens to characters conversion with safety margin)
const MODEL_LIMITS = {
    'gpt-4o': 128000 * 3.5,        // 128k tokens → ~448k chars
    'gpt-4o-mini': 128000 * 3.5,   // 128k tokens → ~448k chars  
    'gpt-4-turbo': 128000 * 3.5,   // 128k tokens → ~448k chars
    'gpt-4': 8192 * 3.5,           // 8k tokens → ~28k chars
    'gpt-3.5-turbo': 16384 * 3.5,  // 16k tokens → ~57k chars
    'gpt-3.5-turbo-16k': 16384 * 3.5, // 16k tokens → ~57k chars
};

// Get prompt size limit for given model
function getPromptSizeLimit(model) {
    // TESTING MODE: Use very low limit to trigger OpenAI errors for analysis
    const TESTING_ERROR_MESSAGES = false; // Set to true to test error message extraction
    if (TESTING_ERROR_MESSAGES) {
        console.log('🧪 TESTING MODE: Using artificially low limit to test OpenAI error messages');
        return 1000; // Very low limit to force errors
    }
    
    if (!model || typeof model !== 'string') {
        return 25000; // Default fallback
    }
    
    // Direct match
    if (MODEL_LIMITS[model]) {
        return Math.floor(MODEL_LIMITS[model] * 0.7); // Use 70% for safety margin
    }
    
    // Partial match for model variants
    for (const [modelName, limit] of Object.entries(MODEL_LIMITS)) {
        if (model.toLowerCase().includes(modelName.toLowerCase())) {
            return Math.floor(limit * 0.7); // Use 70% for safety margin
        }
    }
    
    return 25000; // Default fallback
}

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
            DEFAULT_TOP_K: config.vector_store.content_search_final_count,
            DEFAULT_API_URL: config.web.api.default_url,
            DEFAULT_MODEL: config.web.api.default_model,
            EMBEDDING_MODEL: config.web.api.embedding_model,
            PRELIMINARY_DOCS_PER_PART: config.vector_store.content_search_per_part,
            FINAL_RESULT_COUNT: config.vector_store.content_search_final_count,
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
    
    // Validate representative chunk
    if (!chunks[repIndex]) {
        console.error(`🚫 Invalid representative chunk at index ${repIndex}:`, chunks[repIndex]);
        return 'No content available';
    }
    
    // For vector store chunks without content field, use fallback
    if (!chunks[repIndex].content) {
        console.log(`🔄 Vector store chunk detected (no content field), falling back to representative chunk processing`);
        return 'Representative chunk content requires XML processing';
    }
    
    console.log(`🔗 Context window processing: rep chunk ${repIndex} (${chunks[repIndex].content.length} chars), context=${contextSize}, half=${halfContext}`);
    
    // Start with the representative chunk
    let selectedChunks = [chunks[repIndex]];
    let currentSize = chunks[repIndex].content.length;
    
    // Add chunks before the representative chunk
    let beforeSize = 0;
    let beforeIndex = repIndex - 1;
    const beforeChunks = [];
    
    while (beforeIndex >= 0 && beforeSize < halfContext) {
        const chunk = chunks[beforeIndex];
        if (!chunk || !chunk.content) {
            beforeIndex--;
            continue;
        }
        
        if (beforeSize + chunk.content.length <= halfContext) {
            console.log(`📍 Before chunk ${beforeIndex}: Full chunk added (${chunk.content.length} chars, total: ${beforeSize + chunk.content.length})`);
            beforeChunks.unshift(chunk);
            beforeSize += chunk.content.length;
        } else {
            // Partial chunk - take only what fits
            const remainingSpace = halfContext - beforeSize;
            const partialContent = chunk.content.slice(-remainingSpace);
            console.log(`✂️ Before chunk ${beforeIndex}: Partial chunk added (${partialContent.length}/${chunk.content.length} chars, fits in ${remainingSpace})`);
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
        if (!chunk || !chunk.content) {
            afterIndex++;
            continue;
        }
        
        if (afterSize + chunk.content.length <= halfContext) {
            console.log(`📍 After chunk ${afterIndex}: Full chunk added (${chunk.content.length} chars, total: ${afterSize + chunk.content.length})`);
            afterChunks.push(chunk);
            afterSize += chunk.content.length;
        } else {
            // Partial chunk - take only what fits
            const remainingSpace = halfContext - afterSize;
            const partialContent = chunk.content.slice(0, remainingSpace);
            console.log(`✂️ After chunk ${afterIndex}: Partial chunk added (${partialContent.length}/${chunk.content.length} chars, fits in ${remainingSpace})`);
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

/**
 * Find all chunks for a given curid in the vector store
 * @param {string} curid - The document curid to search for
 * @param {Array} vectorStoreParts - Vector store parts to search in
 * @returns {Array} All chunks with the matching curid
 */
function findChunksByCurid(curid, vectorStoreParts) {
    const chunks = [];
    
    for (const part of vectorStoreParts) {
        for (const doc of part.documents) {
            if (doc.curid === curid || doc.metadata?.curid === curid) {
                chunks.push(doc);
            }
        }
    }
    
    console.log(`🔍 Found ${chunks.length} chunks for curid=${curid}`);
    return chunks;
}

/**
 * Get representative chunks from a large document using vector store chunks
 * @param {string} curid - Document curid
 * @param {Array} vectorStoreParts - Vector store parts to search in
 * @param {number} sizeLimit - Target size limit
 * @returns {string} Representative content from chunks
 */
function getRepresentativeContentFromChunks(curid, vectorStoreParts, sizeLimit = DOCUMENT_SIZE_LIMIT) {
    const chunks = findChunksByCurid(curid, vectorStoreParts);
    
    if (chunks.length === 0) {
        console.log(`⚠️ No chunks found for curid=${curid}, using fallback method`);
        return null;
    }
    
    // Vector store chunks don't have content field, so fallback to XML processing
    console.log(`🔄 Vector store chunks detected for curid=${curid} (${chunks.length} chunks), returning null for XML fallback`);
    return null;
}

/**
 * Process content for LLM: apply size limit and clean MediaWiki markup
 * @param {string} content - Raw content
 * @param {number} refNumber - Citation reference number for logging
 * @param {string} title - Document title for logging
 * @param {string} type - 'title' or 'body' for logging
 * @param {number} sizeLimit - Size limit in characters
 * @param {string} curid - Document curid (for chunk-based processing)
 * @param {Array} vectorStoreParts - Vector store parts (for chunk-based processing)
 * @returns {string} Processed content
 */
function processContentForLLM(content, refNumber, title, type = 'content', sizeLimit = DOCUMENT_SIZE_LIMIT, curid = null, vectorStoreParts = null) {
    console.log(`📄 [${refNumber}] ${type} result: "${title}"`);
    console.log(`📊 [${refNumber}] Original content size: ${content.length.toLocaleString()} chars`);
    
    let processedContent = content;
    
    // Apply size limit check
    if (content.length > sizeLimit) {
        console.log(`🎯 [${refNumber}] Size limit check: ${content.length.toLocaleString()} vs ${sizeLimit.toLocaleString()}`);
        console.log(`🔪 [${refNumber}] ❌ TOO LARGE! Using representative content (limit: ${sizeLimit.toLocaleString()})`);
        
        // Try to use chunk-based processing if curid and vectorStoreParts are available
        if (curid && vectorStoreParts) {
            console.log(`🎯 [${refNumber}] Attempting chunk-based processing for curid=${curid}`);
            const chunkBasedContent = getRepresentativeContentFromChunks(curid, vectorStoreParts, sizeLimit);
            
            if (chunkBasedContent) {
                processedContent = chunkBasedContent;
                console.log(`✂️ [${refNumber}] Chunk-based result: ${processedContent.length.toLocaleString()} chars`);
            } else {
                // Fallback to simple truncation
                console.log(`⚠️ [${refNumber}] Chunk-based processing failed, using simple truncation`);
                processedContent = content.substring(0, sizeLimit) + '\n\n[Content truncated due to size limit]';
                console.log(`✂️ [${refNumber}] Truncated result: ${processedContent.length.toLocaleString()} chars`);
            }
        } else {
            // Simple truncation fallback
            processedContent = content.substring(0, sizeLimit) + '\n\n[Content truncated due to size limit]';
            console.log(`✂️ [${refNumber}] Truncated result: ${processedContent.length.toLocaleString()} chars`);
        }
    } else {
        console.log(`🎯 [${refNumber}] Size limit check: ${content.length.toLocaleString()} vs ${sizeLimit.toLocaleString()}`);
        console.log(`✅ [${refNumber}] WITHIN LIMIT - Using full content`);
    }
    
    // Clean content for LLM prompt
    const cleanedContent = cleanContentForLLM(processedContent);
    const reduction = processedContent.length - cleanedContent.length;
    console.log(`🧹 [${refNumber}] After cleaning: ${cleanedContent.length.toLocaleString()} chars (reduced by ${reduction.toLocaleString()})`);
    
    return cleanedContent;
}

/**
 * Process search result content for both LLM and display purposes
 * @param {Object} result - Search result object
 * @param {number} refNumber - Citation reference number for logging
 * @param {string} type - 'title' or 'body' for logging
 * @param {number} sizeLimit - Size limit in characters for LLM
 * @param {number} displayLimit - Size limit for web display (optional, if different from sizeLimit)
 * @returns {Object} { llmContent, displayContent }
 */
function processSearchResultContent(result, refNumber, type = 'content', sizeLimit = DOCUMENT_SIZE_LIMIT, displayLimit = null) {
    let rawContent;
    
    if (type === 'title') {
        // Title result processing
        rawContent = result.content;
    } else {
        // Body result processing - extract using body-specific logic
        rawContent = extractBodyContent(result, refNumber);
    }
    
    // Process for LLM
    const curid = result.curid || result.metadata?.curid;
    const llmContent = processContentForLLM(
        rawContent,
        refNumber,
        result.title,
        type,
        sizeLimit,
        curid,
        vectorStore?.parts
    );
    
    // Process for display (use same content but with display limit)
    let displayContent = llmContent;
    if (displayLimit && llmContent.length > displayLimit) {
        displayContent = llmContent.substring(0, displayLimit);
        if (displayContent.length < llmContent.length) {
            displayContent += '...';
        }
    }
    
    return { llmContent, displayContent };
}

/**
 * Process body search result to get raw content (handles chunking and merging)
 * @param {Object} result - Body search result object
 * @param {number} refNumber - Citation reference number for logging
 * @returns {string} Raw content before cleaning
 */
function extractBodyContent(result, refNumber) {
    let rawContent;
    
    if (result.isDocumentGroup && result.allChunks && result.allChunks.length > 1) {
        // For document groups, check total size first
        const estimatedSize = result.allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
        
        console.log(`📄 [${refNumber}] Document: "${result.title}"`);
        console.log(`📊 [${refNumber}] Chunks: ${result.allChunks.length}, Total size: ${estimatedSize.toLocaleString()} chars`);
        console.log(`🎯 [${refNumber}] Size limit check: ${estimatedSize.toLocaleString()} vs ${DOCUMENT_SIZE_LIMIT.toLocaleString()}`);
        
        if (estimatedSize > DOCUMENT_SIZE_LIMIT) {
            // Document too large - use representative chunk context
            console.log(`🔪 [${refNumber}] ❌ TOO LARGE! Using representative chunks (limit: ${(DOCUMENT_SIZE_LIMIT / 2).toLocaleString()})`);
            rawContent = getRepresentativeChunksContext(result.allChunks, result, DOCUMENT_SIZE_LIMIT / 2);
            console.log(`✂️ [${refNumber}] Representative chunks result: ${rawContent.length.toLocaleString()} chars`);
        } else {
            // Document within limit - merge all chunks
            console.log(`✅ [${refNumber}] WITHIN LIMIT - Merging all chunks`);
            rawContent = mergeDocumentChunks(result.allChunks);
            console.log(`🔗 [${refNumber}] Merged result: ${rawContent.length.toLocaleString()} chars`);
        }
    } else {
        // For single chunks, use original format
        console.log(`📄 [${refNumber}] Single chunk: "${result.title}"`);
        console.log(`📊 [${refNumber}] Content size: ${(result.content?.length || 0).toLocaleString()} chars`);
        rawContent = result.content || 'No content available';
    }
    
    return rawContent;
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
                    
                    // Debug: Count total documents in title parts
                    let totalTitleDocs = 0;
                    titleParts.forEach((part, index) => {
                        const docCount = part.documents ? part.documents.length : 0;
                        totalTitleDocs += docCount;
                        console.log(`🎯 Title part ${index + 1}: ${docCount} documents`);
                    });
                    console.log(`🎯 Total title documents loaded: ${totalTitleDocs}`);
                } else {
                    console.warn('🎯 No title parts loaded successfully');
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
                const titleResults = await this.searchByTitle(queryEmbedding, CONFIG.FINAL_RESULT_COUNT);
                
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
                            // Debug: Log redirect pages found in search
                            if (doc.curid === '1641' || doc.curid === '8984' || doc.curid === '7919') {
                                console.log(`🚨 DEBUG: Found redirect page in vector store! curid: ${doc.curid}, metadata:`, doc.metadata);
                            }
                            
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
                for (let i = 0; i < partResults.length; i++) {
                    const partResult = partResults[i];
                    console.log(`🔍 Adding ${partResult.length} results from part ${i + 1}`);
                    preliminaryResults.push(...partResult);
                }
                
                // Phase 2: Final ranking of all preliminary results
                preliminaryResults.sort((a, b) => b.score - a.score);
                const finalResults = preliminaryResults.slice(0, k);
                
                console.log(`🔍 Content search: ${preliminaryResults.length} preliminary chunks → ${finalResults.length} final chunks`);
                
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
                    
                    // Debug: Show all chunk document IDs before grouping
                    console.log(`🔍 Before grouping - chunk document IDs:`);
                    enrichedResults.forEach((doc, i) => {
                        const docId = doc.curid || doc.metadata?.curid || doc.metadata?.id || doc.id;
                        const curid = doc.curid || doc.metadata?.curid;
                        const title = doc.metadata ? doc.metadata.title : 'Unknown';
                        console.log(`  Chunk ${i+1}: docId="${docId}", curid="${curid}", title="${title}", score=${doc.score.toFixed(4)}`);
                        if (i < 2) {  // Only show detailed info for first 2 chunks to avoid spam
                            console.log(`    Full metadata:`, doc.metadata);
                            console.log(`    Doc structure:`, Object.keys(doc));
                        }
                    });
                    
                    // Group chunks by document ID
                    const documentGroups = new Map();
                    
                    for (const doc of enrichedResults) {
                        // Try multiple sources for document ID
                        const docId = doc.curid || doc.metadata?.curid || doc.metadata?.id || doc.id;
                        
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
                    
                    console.log(`🔍 Document grouping: ${enrichedResults.length} chunks grouped into ${documentArray.length} documents`);
                    documentArray.slice(0, 5).forEach((group, i) => {
                        const bestChunkLength = group.bestChunk.content.length;
                        console.log(`  Document ${i+1}: "${group.title}" (${group.allChunks.length} chunks, score: ${group.maxScore.toFixed(4)}, best chunk: ${bestChunkLength} chars)`);
                    });
                    
                    // Take top documents (using config setting)
                    processedResults = documentArray.slice(0, CONFIG.FINAL_RESULT_COUNT);
                } else {
                    // Use original chunk-based results
                    processedResults = finalResults;
                }
                
                // Format results
                const formattedResults = processedResults.map((item, index) => {
                    let doc, docScore, docContent;
                    
                    if (GROUP_BY_DOCUMENT) {
                        // Use best chunk as representative
                        console.log(`📋 Document ${index + 1}: Using GROUP_BY_DOCUMENT mode - representative chunk`);
                        doc = item.bestChunk;
                        docScore = item.maxScore;
                        docContent = doc.content; // Use representative chunk content
                        console.log(`📋 Document ${index + 1}: Representative chunk length: ${docContent.length} chars`);
                    } else {
                        // Use chunk directly
                        console.log(`📋 Document ${index + 1}: Using chunk-based mode - direct chunk`);
                        doc = item;
                        docScore = doc.score;
                        docContent = doc.content;
                        console.log(`📋 Document ${index + 1}: Chunk length: ${docContent.length} chars`);
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
            
            searchByTitle: async function(queryEmbedding, k = CONFIG.FINAL_RESULT_COUNT) {
                const titleSimilarities = [];
                
                // Use pre-computed title vector store if available (optimized)
                if (this.titleParts && this.titleParts.length > 0) {
                    // Search pre-computed title embeddings with deduplication
                    const seenDocuments = new Set();
                    let processedCount = 0;
                    let duplicateCount = 0;
                    let noEmbeddingCount = 0;
                    let nanSimilarityCount = 0;
                    let validSimilarityCount = 0;
                    
                    for (let partIndex = 0; partIndex < this.titleParts.length; partIndex++) {
                        const titlePart = this.titleParts[partIndex];
                        
                        for (let docIndex = 0; docIndex < titlePart.documents.length; docIndex++) {
                            processedCount++;
                            const doc = titlePart.documents[docIndex];
                            
                            // Handle both binary and array formats
                            let embedding;
                            try {
                                if (doc.embedding_binary && doc.embedding_format === 'float32_base64') {
                                    embedding = Array.from(base64ToFloat32Array(doc.embedding_binary));
                                } else if (doc.embedding && Array.isArray(doc.embedding)) {
                                    embedding = doc.embedding;
                                } else {
                                    noEmbeddingCount++;
                                    continue;
                                }
                            } catch (error) {
                                console.error(`🎯 Error processing embedding for doc ${docIndex}:`, error);
                                continue;
                            }
                            
                            // Use curid if available, otherwise fall back to doc.id
                            const docId = doc.curid || doc.metadata?.curid || doc.id;
                            
                            if (seenDocuments.has(docId)) {
                                duplicateCount++;
                                continue; // Skip duplicates
                            }
                            seenDocuments.add(docId);
                            
                            const titleSimilarity = cosineSimilarity(queryEmbedding, embedding);
                            
                            // Debug log for specific document (ペア数列の停止性)
                            if (doc.curid === "3659" || (doc.metadata && doc.metadata.curid === "3659")) {
                                console.log(`🎯 DEBUG: ペア数列の停止性 (curid=3659) - Similarity: ${titleSimilarity.toFixed(6)}, Title: "${doc.metadata?.title}"`);
                            }
                            
                            if (!isNaN(titleSimilarity)) {
                                validSimilarityCount++;
                                titleSimilarities.push({
                                    id: doc.id,
                                    content: doc.content,
                                    metadata: doc.metadata,
                                    curid: doc.curid,  // Include curid for XML content lookup
                                    score: titleSimilarity,
                                    partIndex: partIndex
                                });
                            } else {
                                nanSimilarityCount++;
                            }
                        }
                    }
                    
                    console.log(`🎯 Title search: processed ${processedCount} docs, found ${titleSimilarities.length} valid similarities`);
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
                console.log(`🎯 Title search: Found ${titleSimilarities.length} similarities, returning top ${k}`);
                
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
            
            // Add redirect information if available
            const redirectInfo = result.metadata?.redirect_target || result.redirect_target;
            if (redirectInfo) {
                scoreText += ` | redirect: ${redirectInfo}`;
            }
            
            // Use common processing function with 1000 char display limit
            const { displayContent } = processSearchResultContent(result, refNumber, 'title', DOCUMENT_SIZE_LIMIT, 1000);
            
            return `
            <div class="rag-result">
                <div class="result-header">
                    <span class="result-number">[${refNumber}]</span>
                    <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                    <span class="result-score">${scoreText}</span>
                </div>
                <div class="result-content">
                    ${displayContent}
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
            
            // Add redirect information if available
            const redirectInfo = result.metadata?.redirect_target || result.redirect_target;
            if (redirectInfo) {
                scoreText += ` | redirect: ${redirectInfo}`;
            }
            
            // Use common processing function with 1000 char display limit
            const { displayContent } = processSearchResultContent(result, refNumber, 'body', DOCUMENT_SIZE_LIMIT, 1000);
            
            return `
            <div class="rag-result">
                <div class="result-header">
                    <span class="result-number">[${refNumber}]</span>
                    <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                    <span class="result-score">${scoreText}</span>
                </div>
                <div class="result-content">
                    ${displayContent}
                </div>
            </div>
            `;
        }).join('');
        
        resultsHTML += `<h3>RAG Search Results (body)</h3>${bodyHTML}`;
    }
    
    elements.ragWindow.innerHTML = resultsHTML;
}

// Display LLM prompt in dedicated debug section
function displayLLMPrompt(systemPrompt, userQuery, promptSize = null) {
    const debugSection = document.getElementById('llm-prompt-debug-section');
    const systemPromptContent = document.getElementById('system-prompt-content');
    const userQueryContent = document.getElementById('user-query-content');
    
    if (SHOW_LLM_PROMPT && debugSection && systemPromptContent && userQueryContent) {
        // Add prompt size information to system prompt display
        let systemPromptWithSize = systemPrompt;
        if (promptSize !== null) {
            const sizeInfo = `\n\n=== PROMPT SIZE INFO ===\nTotal characters: ${promptSize.toLocaleString()}\nSystem prompt: ${systemPrompt.length.toLocaleString()}\nUser query: ${userQuery.length.toLocaleString()}\n========================\n\n`;
            systemPromptWithSize = sizeInfo + systemPrompt;
        }
        
        systemPromptContent.textContent = systemPromptWithSize;
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
            
            // Use common processing function
            const { llmContent } = processSearchResultContent(result, refNumber, 'title', DOCUMENT_SIZE_LIMIT);
            
            return `[${refNumber}] **${result.title}**\n${llmContent}`;
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
            
            // Use common processing function
            const { llmContent } = processSearchResultContent(result, refNumber, 'body', DOCUMENT_SIZE_LIMIT);
            
            return `[${refNumber}] **${result.title}**\n${llmContent}`;
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
        
        // Check prompt size limit using dynamic model-based limits
        const totalPromptSize = systemPrompt.length + query.length;
        const currentModel = elements.modelSelect.value || CONFIG.DEFAULT_MODEL;
        const dynamicLimit = getPromptSizeLimit(currentModel);
        
        console.log('Prompt size check:', {
            model: currentModel,
            systemPromptLength: systemPrompt.length,
            queryLength: query.length,
            totalSize: totalPromptSize,
            staticLimit: PROMPT_SIZE_LIMIT,
            dynamicLimit: dynamicLimit,
            withinDynamicLimit: totalPromptSize <= dynamicLimit,
            combinedContextLength: combinedContext.length,
            exceedsBy: totalPromptSize - dynamicLimit
        });
        
        if (totalPromptSize > dynamicLimit) {
            promptSizeWarning = ` Warning: Prompt size (${totalPromptSize}) exceeds ${currentModel} limit (${dynamicLimit}). OpenAI will likely reject this with Error 400.`;
            console.warn(`Prompt size (${totalPromptSize}) exceeds ${currentModel} limit (${dynamicLimit}). OpenAI will likely reject this with Error 400.`);
            // Note: We continue with the full context but log the warning.
            // The cleaning should have reduced the size significantly.
        }
        
        // Display LLM prompt in debug section with size information
        displayLLMPrompt(systemPrompt, query, totalPromptSize);
        
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
                model: currentModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
                max_tokens: 3000
            })
        });
        
        if (!response.ok) {
            // Get the actual error response body for analysis
            let errorBody;
            try {
                errorBody = await response.text();
                console.log('🔍 OpenAI error response body:', errorBody);
                
                // Try to parse as JSON for structured error info
                try {
                    const errorJson = JSON.parse(errorBody);
                    console.log('🔍 OpenAI error JSON:', errorJson);
                } catch (jsonError) {
                    console.log('🔍 Error response is not JSON');
                }
            } catch (bodyError) {
                console.log('🔍 Could not read error response body:', bodyError);
                errorBody = 'Could not read error response';
            }
            
            const error = new Error(`OpenAI API request failed: ${response.status}`);
            error.response = {
                status: response.status,
                statusText: response.statusText,
                body: errorBody
            };
            throw error;
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
        
        // Get dynamic limit for error analysis
        const currentModel = elements.modelSelect.value || CONFIG.DEFAULT_MODEL;
        const dynamicLimit = getPromptSizeLimit(currentModel);
        
        // Log full error details for analysis
        console.log('🔍 Full error object:', error);
        console.log('🔍 Error message:', error.message);
        console.log('🔍 Error response:', error.response);
        if (error.response) {
            console.log('🔍 Error response status:', error.response.status);
            console.log('🔍 Error response body:', error.response.body);
            if (error.response.data) {
                console.log('🔍 Error response data:', error.response.data);
            }
            
            // Try to extract actual token limit from OpenAI error response
            const extractedLimit = extractTokenLimitFromError(error.response.body);
            if (extractedLimit) {
                console.log(`🔍 OpenAI actual token limit detected: ${extractedLimit} chars (current setting: ${dynamicLimit} chars)`);
                // Could potentially update limits dynamically here
            }
        }
        
        elements.responseWindow.innerHTML = `<p class="error">Failed to generate response: ${error.message}${promptSizeWarning}</p>`;
    }
}

// Save settings to localStorage
function saveSettingsToLocalStorage(elements) {
    try {
        const settings = {
            baseUrl: elements.baseUrl.value.trim(),
            model: elements.modelSelect.value
        };
        localStorage.setItem('ragSettings', JSON.stringify(settings));
        console.log('Settings saved to localStorage:', settings);
    } catch (error) {
        console.warn('Could not save settings to localStorage:', error);
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage(elements) {
    try {
        const savedSettings = localStorage.getItem('ragSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.baseUrl) {
                elements.baseUrl.value = settings.baseUrl;
                console.log('Restored base URL from localStorage:', settings.baseUrl);
            }
            if (settings.model) {
                elements.modelSelect.value = settings.model;
                console.log('Restored model from localStorage:', settings.model);
            }
            return true;
        }
    } catch (error) {
        console.warn('Could not restore settings from localStorage:', error);
    }
    return false;
}

// Initialize RAG system with given currentSite
async function initializeRAG(currentSite) {
    // Get DOM elements
    const elements = {
        baseUrl: document.getElementById('base-url'),
        modelSelect: document.getElementById('model-select'),
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
    
    // Try to load saved settings from localStorage, otherwise use defaults
    const settingsLoaded = loadSettingsFromLocalStorage(elements);
    if (!settingsLoaded) {
        // Set default API URL and model only if no saved settings
        elements.baseUrl.value = CONFIG.DEFAULT_API_URL;
        elements.modelSelect.value = CONFIG.DEFAULT_MODEL;
    }
    
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
    
    // Listen for input changes to update error messages and save settings
    elements.baseUrl.addEventListener('input', () => {
        checkAndShowErrors(elements);
        saveSettingsToLocalStorage(elements);
    });
    elements.modelSelect.addEventListener('change', () => {
        checkAndShowErrors(elements);
        saveSettingsToLocalStorage(elements);
    });
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
