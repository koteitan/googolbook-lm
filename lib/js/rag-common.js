// RAG Common Module - Shared functionality across all sites
// Environment-specific imports (browser vs Node.js)
let yamlLoad, pako, pipelineImport, alert;

// Test mode flag - enables window.vectorStore synchronization for testing
const TEST_MODE = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true');

// Debug logging helper - only active in TEST_MODE
const debugLog = TEST_MODE ? console.log : () => {};

// Initialize environment-specific dependencies
async function initializeDependencies() {
    // Determine if running in Node.js or browser (treat as Node.js even when window exists in JSDOM)
    const isNodeJs = typeof process !== 'undefined' && process.versions && process.versions.node;
    
    if (isNodeJs) {
        // Node.js environment - use nodejs header
        const { yamlLoad: yl, pako: p, pipelineImport: pi, alert: a } = await import('./nodejs-header.js');
        yamlLoad = yl;
        pako = p;
        pipelineImport = pi;
        alert = a;
    } else {
        // Browser environment - use browser header
        const { yamlLoad: yl, pako: p, pipelineImport: pi, alert: a } = await import('./browser-header.js');
        yamlLoad = yl;
        pako = p;
        pipelineImport = pi;
        alert = a;
    }
}

// kuromoji loaded globally via script tag in HTML

// Show full chunk content in RAG results (same as what LLM sees)
const SHOW_FULL_RAG_CONTENT = true;

// Group search results by document and show top 10 documents (vs. top chunks)
const GROUP_BY_DOCUMENT = true;

// Skip LLM keyword extraction and use query directly for RAG search
const SKIP_LLM_KEYWORD_EXTRACTION = true;

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
                    const charLimit = Math.floor(tokenLimit * CHARS_PER_TOKEN);
                    return charLimit;
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Token to character conversion ratio for Japanese text
const CHARS_PER_TOKEN = 1.8;

// Document processing thresholds
const MAX_TOKENS_PER_DOCUMENT = 100000;
const REPRESENTATIVE_CONTEXT_TOKENS = 100000;

// Multi-provider model limits (tokens to characters conversion with safety margin)
const MODEL_LIMITS = {
    // OpenAI models
    'o3-pro': 200000 * CHARS_PER_TOKEN,        // 200k tokens → ~700k chars
    'o4-mini': 200000 * CHARS_PER_TOKEN,       // 200k tokens → ~700k chars
    'gpt-4o': 128000 * CHARS_PER_TOKEN,        // 128k tokens → ~448k chars
    'gpt-4o-mini': 128000 * CHARS_PER_TOKEN,   // 128k tokens → ~448k chars  
    'gpt-4-turbo': 128000 * CHARS_PER_TOKEN,   // 128k tokens → ~448k chars
    'gpt-4': 8192 * CHARS_PER_TOKEN,           // 8k tokens → ~28k chars
    'gpt-3.5-turbo': 16384 * CHARS_PER_TOKEN,  // 16k tokens → ~57k chars
    'gpt-3.5-turbo-16k': 16384 * CHARS_PER_TOKEN, // 16k tokens → ~57k chars
    
    // Claude models (estimated token limits)
    'claude-opus-4-20250514': 200000 * CHARS_PER_TOKEN,      // ~200k tokens → ~700k chars
    'claude-sonnet-4-20250514': 200000 * CHARS_PER_TOKEN,    // ~200k tokens → ~700k chars
    'claude-3-7-sonnet-20250219': 200000 * CHARS_PER_TOKEN,  // ~200k tokens → ~700k chars
    'claude-3-5-sonnet-20241022': 200000 * CHARS_PER_TOKEN,  // ~200k tokens → ~700k chars
    'claude-3-5-haiku-20241022': 200000 * CHARS_PER_TOKEN,   // ~200k tokens → ~700k chars
    'claude-3-haiku-20240307': 200000 * CHARS_PER_TOKEN,     // ~200k tokens → ~700k chars
    
    // Gemini models (estimated token limits)
    'gemini-2.5-pro': 2000000 * CHARS_PER_TOKEN,    // ~2M tokens → ~7M chars
    'gemini-2.5-flash': 1000000 * CHARS_PER_TOKEN,  // ~1M tokens → ~3.5M chars
    
    // OpenRouter models (same as underlying models)
    'openrouter/openai/chatgpt-4o-latest': 128000 * CHARS_PER_TOKEN,    // 128k tokens → ~448k chars
    'openrouter/openai/o3-pro': 200000 * CHARS_PER_TOKEN,               // 200k tokens → ~700k chars
    'openrouter/openai/o4-mini': 200000 * CHARS_PER_TOKEN,              // 200k tokens → ~700k chars
    'openrouter/anthropic/claude-opus-4': 200000 * CHARS_PER_TOKEN,     // ~200k tokens → ~700k chars
    'openrouter/anthropic/claude-sonnet-4': 200000 * CHARS_PER_TOKEN,   // ~200k tokens → ~700k chars
    'openrouter/anthropic/claude-3.7-sonnet': 200000 * CHARS_PER_TOKEN, // ~200k tokens → ~700k chars
    'openrouter/anthropic/claude-3.5-sonnet': 200000 * CHARS_PER_TOKEN, // ~200k tokens → ~700k chars
    'openrouter/google/gemini-2.5-pro': 2000000 * CHARS_PER_TOKEN,      // ~2M tokens → ~7M chars
    'openrouter/google/gemini-2.5-flash': 1000000 * CHARS_PER_TOKEN,    // ~1M tokens → ~3.5M chars
    
    // Azure OpenAI models (same as OpenAI models)
    'azure/gpt-4o': 128000 * CHARS_PER_TOKEN,        // 128k tokens → ~448k chars
    'azure/gpt-4o-mini': 128000 * CHARS_PER_TOKEN,   // 128k tokens → ~448k chars
    'azure/gpt-4-turbo': 128000 * CHARS_PER_TOKEN,   // 128k tokens → ~448k chars
    'azure/gpt-4': 8192 * CHARS_PER_TOKEN,           // 8k tokens → ~28k chars
    'azure/gpt-3.5-turbo': 16384 * CHARS_PER_TOKEN,  // 16k tokens → ~57k chars
};

// Provider detection from model name
function getProviderFromModel(model) {
    if (!model) return 'openai';
    
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'claude';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('openrouter/')) return 'openrouter';
    if (model.startsWith('azure/')) return 'azure-openai';
    
    return 'openai'; // default fallback
}


// Provider-specific configuration
const PROVIDER_CONFIG = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyPlaceholder: 'Enter OpenAI API key',
        apiKeyHelp: 'Enter your <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API key</a>',
        baseUrlPlaceholder: 'https://api.openai.com/v1'
    },
    claude: {
        name: 'Claude (Anthropic)',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyPlaceholder: 'Enter Anthropic API key',
        apiKeyHelp: 'Enter your <a href="https://console.anthropic.com/" target="_blank">Anthropic API key</a>',
        baseUrlPlaceholder: 'https://api.anthropic.com/v1'
    },
    gemini: {
        name: 'Gemini (Google)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKeyPlaceholder: 'Enter Google API key',
        apiKeyHelp: 'Enter your <a href="https://makersuite.google.com/app/apikey" target="_blank">Google API key</a>',
        baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta'
    },
    openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyPlaceholder: 'Enter OpenRouter API key',
        apiKeyHelp: 'Enter your <a href="https://openrouter.ai/keys" target="_blank">OpenRouter API key</a>',
        baseUrlPlaceholder: 'https://openrouter.ai/api/v1'
    },
    'azure-openai': {
        name: 'Open AI Compatible API',
        baseUrl: 'https://your-resource.openai.azure.com',
        apiKeyPlaceholder: 'Enter Open AI Compatible API key',
        apiKeyHelp: 'Enter your <a href="#" target="_blank">Open AI Compatible API key</a>',
        baseUrlPlaceholder: 'https://your-resource.openai.azure.com'
    }
};

// Get prompt size limit for given model
function getPromptSizeLimit(model) {
    // TESTING MODE: Use very low limit to trigger OpenAI errors for analysis
    const TESTING_ERROR_MESSAGES = false; // Set to true to test error message extraction
    if (TESTING_ERROR_MESSAGES) {
        return 1000; // Very low limit to force errors
    }
    
    if (!model || typeof model !== 'string') {
        return 25000; // Default fallback
    }
    
    // Direct match
    if (MODEL_LIMITS[model]) {
        return Math.floor(MODEL_LIMITS[model] * 0.5); // Use 50% for safety margin
    }
    
    // Partial match for model variants
    for (const [modelName, limit] of Object.entries(MODEL_LIMITS)) {
        if (model.toLowerCase().includes(modelName.toLowerCase())) {
            return Math.floor(limit * 0.5); // Use 50% for safety margin
        }
    }
    
    return 25000; // Default fallback
}

// Get current model from UI
function getCurrentModel(elements) {
    return elements && elements.modelSelect ? elements.modelSelect.value : 'gpt-4o';
}

// Limit for total prompt size (to avoid OpenAI token limits)
const PROMPT_SIZE_LIMIT = 25000;

// Show the complete prompt sent to LLM (system prompt + context + user query) for debugging
const SHOW_LLM_PROMPT = true;

// Note: Morphological analysis removed - multilingual models handle tokenization internally

// Enable title-based search (will be fixed by updating vector store)
const USE_TITLE_SEARCH = true;

// Update license information in footer
async function updateLicenseInfo(config, elements) {
    try {
        // Update license link
        if (elements.licenseLink && config.license) {
            elements.licenseLink.href = config.license.url;
            elements.licenseLink.textContent = config.license.short;
        }
        
        // Load and display fetch date from fetch_log.txt
        if (elements.fetchDate) {
            try {
                const response = await fetch('./fetch_log.txt');
                if (response.ok) {
                    const logContent = await response.text();
                    const firstLine = logContent.split('\n')[0];
                    // Extract date from "Archive fetched: YYYY-MM-DD HH:MM:SS"
                    const dateMatch = firstLine.match(/Archive fetched: (.+)/);
                    if (dateMatch) {
                        elements.fetchDate.textContent = dateMatch[1];
                    } else {
                        elements.fetchDate.textContent = 'unknown';
                    }
                } else {
                    elements.fetchDate.textContent = 'unknown';
                }
            } catch (error) {
                //console.warn('Failed to load fetch date:', error);
                elements.fetchDate.textContent = 'unknown';
            }
        }
    } catch (error) {
        //console.warn('Failed to update license info:', error);
    }
}

// Global state
let vectorStore = null;

// Test mode: Initialize window.vectorStore for test environment access
if (TEST_MODE && typeof window !== 'undefined') {
    window.vectorStore = null;
}
let isLoading = false;
let embedder = null;
let CONFIG = null; // Will be loaded from YAML
// xmlData is no longer used - we use xmlIndex for JSONL data
let xmlIndex = {}; // curid -> page mapping for fast lookup

// Load configuration from YAML
async function loadConfig(currentSite, elements) {
    debugLog('[DEBUG] loadConfig start:', currentSite);
    try {
        const configPath = `./config.yml`;
        debugLog('[DEBUG] config.yml fetch start:', configPath);
        
        const response = await fetch(configPath);
        debugLog('[DEBUG] config.yml fetch result:', response.ok, response.status);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        
        const yamlText = await response.text();
        debugLog('[DEBUG] YAML text length:', yamlText.length);
        debugLog('[DEBUG] YAML parse start');
        const config = yamlLoad(yamlText);
        debugLog('[DEBUG] YAML parse complete:', config ? 'success' : 'failed');
        
        // Check if we're on a local address and auto_local_path is enabled
        const isLocalAccess = elements.window.location.hostname === '127.0.0.1' || 
                             elements.window.location.hostname === 'localhost' ||
                             elements.window.location.hostname.startsWith('192.168.') ||
                             elements.window.location.hostname.startsWith('10.') ||
                             elements.window.location.hostname.startsWith('172.');
        
        const useLocalPath = config.web.auto_local_path && isLocalAccess;
        const finalPartPathTemplate = useLocalPath ? 
            './vector_store_part{}.json.gz' : 
            config.web.vector_store.part_path_template;
        
        // Map site names to JSONL file names
        const jsonlFileMap = {
            'ja-googology-wiki': 'jagoogology_pages_current.jsonl.gz',
            'googology-wiki': 'googology_pages_current.jsonl.gz'
        };
        
        const finalJsonlGzPath = useLocalPath ? 
            `./${jsonlFileMap[config.web.current_site] || config.web.current_site + '_pages_current.jsonl.gz'}` : 
            config.web.jsonl_gz_path;
        
        // Create CONFIG object from YAML
        debugLog('[DEBUG] CONFIG build start');
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
            JSONL_GZ_PATH: finalJsonlGzPath || null,
            // Add tokenization configuration
            TOKENIZE_MODE: config.tokenize?.mode || 'normal'
        };
        
        // Store full config for RAG system
        CONFIG.FULL_CONFIG = config;
        
        // Update license information in footer (will be called from initializeRAG with elements)
        // updateLicenseInfo(config, elements);
        
        debugLog('[DEBUG] CONFIG build complete');
        return CONFIG;
    } catch (error) {
        //console.error('[DEBUG] loadConfig error:', error);
        throw error;
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
        //console.warn('Overlap removal failed:', error);
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

function getRepresentativeChunksContext(chunks, representativeChunk, contextSize = 5000) {
    /**
     * Get chunks around the representative chunk within the context size limit
     * Returns merged content centered around the representative chunk
     */
    if (!chunks || chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0]?.content || '';
    
    // Find the representative chunk in the chunks array
    const repIndex = chunks.findIndex(chunk => 
        chunk && chunk.content && representativeChunk && (
            chunk.content === representativeChunk.content || 
            chunk.id === representativeChunk.id
        )
    );
    
    if (repIndex === -1) {
        //console.warn('Representative chunk not found in chunks array');
        return representativeChunk?.content || '';
    }
    
    // Calculate how much context to take before and after
    const halfContext = Math.floor(contextSize / 2);
    
    // Validate representative chunk
    if (!chunks[repIndex]) {
        //console.error(`🚫 Invalid representative chunk at index ${repIndex}:`, chunks[repIndex]);
        return 'No content available';
    }
    
    // For vector store chunks without content field, use fallback
    if (!chunks[repIndex].content) {
        return 'Representative chunk content requires XML processing';
    }
    
    
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
        if (!chunk || !chunk.content) {
            afterIndex++;
            continue;
        }
        
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
        //console.error('Invalid vectors for cosine similarity:', {
        //    vecA: vecA ? vecA.length : 'null',
        //    vecB: vecB ? vecB.length : 'null'
        //});
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        const a = vecA[i];
        const b = vecB[i];
        
        if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) {
            //console.error(`Invalid vector components at index ${i}:`, { a, b });
            return 0;
        }
        
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0 || isNaN(normA) || isNaN(normB)) {
        //console.error('Invalid norms:', { normA, normB });
        return 0;
    }
    
    const similarity = dotProduct / (normA * normB);
    
    if (isNaN(similarity)) {
        //console.error('NaN similarity result:', { dotProduct, normA, normB });
        return 0;
    }
    
    return similarity;
}

// Load and parse compressed JSONL file
async function loadCompressedJSONL(jsonlGzPath, updateProgress) {
    try {
        updateProgress(0, 'Downloading JSONL file...');
        
        let response = await fetch(jsonlGzPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch JSONL: ${response.status}`);
        }
        
        // Read as array buffer
        const compressedData = await response.arrayBuffer();
        updateProgress(50, 'Decompressing JSONL...');
        
        // Decompress using pako
        const decompressed = pako.inflate(new Uint8Array(compressedData));
        const text = new TextDecoder().decode(decompressed);
        updateProgress(75, 'Parsing JSONL...');
        
        // Parse JSONL and build index
        xmlIndex = {};
        const lines = text.split('\n');
        let validPages = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                try {
                    const page = JSON.parse(line);
                    if (page.curid) {
                        // Store both string and number versions of curid for compatibility
                        xmlIndex[page.curid] = page;
                        xmlIndex[String(page.curid)] = page;
                        if (!isNaN(page.curid)) {
                            xmlIndex[Number(page.curid)] = page;
                        }
                        validPages++;
                    }
                } catch (e) {
                    console.warn(`Failed to parse JSONL line ${i + 1}:`, e);
                }
            }
            
            if (i % 1000 === 0 && i > 0) {
                const progress = 75 + (i / lines.length) * 20;
                updateProgress(progress, `Processing pages: ${validPages.toLocaleString()}...`);
            }
        }
        
        updateProgress(100, `JSONL loaded: ${validPages} pages indexed`);
        
        return true;
    } catch (error) {
        //console.error('Error loading data:', error);
        throw error;
    }
}

// Get page content from JSONL by curid
function getPageFromXML(curid) {
    if (!xmlIndex || !xmlIndex[curid]) {
        return null;
    }
    
    const page = xmlIndex[curid];
    
    // JSONL format
    return {
        title: page.title,
        content: page.text,
        curid: curid,
        timestamp: page.timestamp // Include timestamp if available
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
    const testText = `Source: [http://www.nicovideo.jp/mylist/35451262 Large Number Video Series] (Nico Nico Douga) - [http://www.nicovideo.jp/watch/sm19439423 [Learning Slowly] Explaining Graham's Number [Re-upload Version]]

Source: [https://www.nicovideo.jp/watch/sm45062367 Kiritan's Large Number Explanation "Primitive Recursion and Graham's Number"]`;

    
    // Test the regex pattern
    const pattern = /\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g;
    let match;
    while ((match = pattern.exec(testText)) !== null) {
    }
    
    // Test replacement
    const cleaned = testText.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
    
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
    
    return chunks;
}

/**
 * Get representative chunks from a large document using vector store chunks
 * @param {string} curid - Document curid
 * @param {Array} vectorStoreParts - Vector store parts to search in
 * @param {number} sizeLimit - Target size limit
 * @returns {string} Representative content from chunks
 */
function getRepresentativeContentFromChunks(curid, vectorStoreParts, elements, sizeLimit = null) {
    const chunks = findChunksByCurid(curid, vectorStoreParts);
    
    if (chunks.length === 0) {
        return null;
    }
    
    // Vector store chunks don't have content field, so fallback to XML processing
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
function processContentForLLM(content, refNumber, title, elements, type = 'content', sizeLimit = null, curid = null, vectorStoreParts = null) {
    
    let processedContent = content;
    
    // No size limit check - always use full content
    
    // Clean content for LLM prompt
    const cleanedContent = cleanContentForLLM(processedContent);
    const reduction = processedContent.length - cleanedContent.length;
    
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
function processSearchResultContent(result, refNumber, elements, type = 'content', sizeLimit = null, displayLimit = null) {
    let rawContent;
    
    if (type === 'title') {
        // Title result processing
        rawContent = result.content;
        
        // Check if this is a redirect page content in title search too
        if (rawContent && typeof rawContent === 'string' && 
            (rawContent.trim().startsWith('#REDIRECT') || rawContent.trim().startsWith('#転送'))) {
            
            // Extract redirect target from the content
            const redirectMatch = rawContent.match(/#(?:REDIRECT|転送)\s*(.+)/);
            if (redirectMatch) {
                let redirectTarget = redirectMatch[1].trim();
                
                // Remove wiki link brackets if present: [[Page Name]] -> Page Name
                redirectTarget = redirectTarget.replace(/^\[\[(.+)\]\]$/, '$1');
                
                
                // Try to find the actual content for the redirect target
                const targetContent = findRedirectTargetContent(redirectTarget);
                if (targetContent) {
                    rawContent = targetContent;
                } else {
                    // Provide a helpful message instead of the redirect text
                    rawContent = `This article has been redirected to "${redirectTarget}". Please refer to the "${redirectTarget}" page for details.`;
                }
            }
        }
        
        // Check if title content is too large and apply size reduction
        if (rawContent && typeof rawContent === 'string') {
            const contentSize = rawContent.length;
            const estimatedTokens = contentSize / CHARS_PER_TOKEN;
            
            // Get current model limits dynamically
            const currentModel = getCurrentModel(elements);
            const modelLimitChars = getPromptSizeLimit(currentModel);
            const modelLimitTokens = modelLimitChars / CHARS_PER_TOKEN;
            const documentSizeThreshold = modelLimitTokens * 0.3;
            const contextSizeTokens = Math.min(modelLimitTokens * 0.2, REPRESENTATIVE_CONTEXT_TOKENS);
            
            if (estimatedTokens > documentSizeThreshold) {
                // Title content too large - truncate to context size
                const contextSize = contextSizeTokens * CHARS_PER_TOKEN;
                rawContent = rawContent.substring(0, Math.floor(contextSize));
            }
        }
    } else {
        // Body result processing - extract using body-specific logic
        rawContent = extractBodyContent(result, refNumber, elements);
    }
    
    // Process for LLM
    const curid = result.curid || result.metadata?.curid;
    const llmContent = processContentForLLM(
        rawContent,
        refNumber,
        result.title,
        elements,
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
function extractBodyContent(result, refNumber, elements) {
    let rawContent;
    
    if (result.isDocumentGroup && result.allChunks && result.allChunks.length > 1) {
        // For document groups, check total size first
        const estimatedSize = result.allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
        const estimatedTokens = estimatedSize / CHARS_PER_TOKEN;
        
        // Get current model limits dynamically
        const currentModel = getCurrentModel(elements);
        const modelLimitChars = getPromptSizeLimit(currentModel);
        const modelLimitTokens = modelLimitChars / CHARS_PER_TOKEN;
        const documentSizeThreshold = modelLimitTokens * 0.3;
        const contextSizeTokens = Math.min(modelLimitTokens * 0.2, REPRESENTATIVE_CONTEXT_TOKENS);
        
        if (estimatedTokens > documentSizeThreshold) {
            // Document too large - use representative chunk selection
            const contextSize = contextSizeTokens * CHARS_PER_TOKEN;
            if (result.allChunks && result.bestChunk) {
                rawContent = getRepresentativeChunksContext(result.allChunks, result.bestChunk, contextSize);
            } else {
                // Fallback to content property if chunks not available
                rawContent = result.content || '';
            }
        } else {
            // Merge all chunks (within threshold)
            if (result.allChunks) {
                rawContent = mergeDocumentChunks(result.allChunks);
            } else {
                // Fallback to content property if chunks not available
                rawContent = result.content || '';
            }
        }
    } else {
        // For single chunks, check size too
        const content = result.content || 'No content available';
        const contentSize = content.length;
        const estimatedTokens = contentSize / CHARS_PER_TOKEN;
        
        // Get current model limits dynamically
        const currentModel = getCurrentModel(elements);
        const modelLimitChars = getPromptSizeLimit(currentModel);
        const modelLimitTokens = modelLimitChars / CHARS_PER_TOKEN;
        const documentSizeThreshold = modelLimitTokens * 0.3;
        const contextSizeTokens = Math.min(modelLimitTokens * 0.2, REPRESENTATIVE_CONTEXT_TOKENS);
        
        if (estimatedTokens > documentSizeThreshold) {
            // Single chunk too large - truncate to context size
            const contextSize = contextSizeTokens * CHARS_PER_TOKEN;
            rawContent = content.substring(0, Math.floor(contextSize));
        } else {
            // Single chunk within threshold, using full content
            rawContent = content;
        }
    }
    
    // Check if this is a redirect page content (starts with #転送 or similar)
    if (rawContent && typeof rawContent === 'string' && rawContent.trim().startsWith('#転送')) {
        
        // Extract redirect target from the content
        const redirectMatch = rawContent.match(/#転送\s*(.+)/);
        if (redirectMatch) {
            let redirectTarget = redirectMatch[1].trim();
            
            // Remove wiki link brackets if present: [[Page Name]] -> Page Name
            redirectTarget = redirectTarget.replace(/^\[\[(.+)\]\]$/, '$1');
            
            
            // Try to find the actual content for the redirect target
            const targetContent = findRedirectTargetContent(redirectTarget);
            if (targetContent) {
                rawContent = targetContent;
            } else {
                // Provide a helpful message instead of the redirect text
                rawContent = `This article has been redirected to "${redirectTarget}". Please refer to the "${redirectTarget}" page for details.`;
            }
        }
    }
    
    return rawContent;
}

/**
 * Find the actual content for a redirect target page
 * @param {string} targetTitle - The target page title to find content for
 * @returns {string|null} The content of the target page, or null if not found
 */
function findRedirectTargetContent(targetTitle) {
    if (!vectorStore || !vectorStore.parts) {
        return null;
    }
    
    // Search through all parts of the vector store
    for (const part of vectorStore.parts) {
        if (!part.documents) continue;
        
        // Look for documents with matching title that are not redirects
        for (const doc of part.documents) {
            const docTitle = doc.metadata?.title;
            
            // Check if this document matches the target title and has actual content (not a redirect)
            if (docTitle === targetTitle && 
                doc.content && 
                !doc.content.trim().startsWith('#転送')) {
                
                return doc.content;
            }
        }
    }
    
    return null;
}

// Clean MediaWiki content for LLM prompt generation
function cleanContentForLLM(content) {
    if (!content || typeof content !== 'string') {
        return content;
    }
    
    
    const originalLength = content.length;
    let cleaned = content;
    
    // Debug: Check if content contains the problematic sections
    const hasRelatedItems = cleaned.includes('== 関連項目 ==');
    const hasReferences = cleaned.includes('== 出典 ==');
    const hasLanguageLinks = /\[\[[a-z]{2}:[^\]]*\]\]/.test(cleaned);
    const hasCategories = /\[\[Category:[^\]]*\]\]/.test(cleaned);
    const hasExternalLinks = /\[https?:\/\/[^\]]+\]/.test(cleaned);
    const hasInternalLinks = /\[\[[^\]]+\]\]/.test(cleaned);
    
    //     originalLength,
    //     hasRelatedItems,
    //     hasReferences, 
    //     hasLanguageLinks,
    //     hasCategories,
    //     hasExternalLinks,
    //     hasInternalLinks,
    //     contentEnd: cleaned.slice(-500)
    // });
    
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
    }
    
    // Handle various formats of external links
    // Main pattern: [http://URL text] or [https://URL text] - extract just the text part
    // Use non-greedy match for URL part, then space(s), then capture text part
    cleaned = cleaned.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, function(match, textPart) {
        return textPart;
    });
    // Fallback: Remove any remaining pure URL links without text
    cleaned = cleaned.replace(/\[https?:\/\/[^\]]+\]/g, '');
    
    // Debug: Check what external links remain after processing
    const remainingExternalLinks = cleaned.match(/\[https?:\/\/[^\]]+\]/g);
    if (remainingExternalLinks) {
    }
    
    // 6. Remove language links (they can appear anywhere)
    cleaned = cleaned.replace(/\[\[[a-z]{2}:[^\]]*\]\]/g, '');
    
    // 7. Remove category tags
    cleaned = cleaned.replace(/\[\[Category:[^\]]*\]\]/g, '');
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
    cleaned = cleaned.replace(/\n*\[\[Category:[^\]]*\]\]\s*/g, '');
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
    const stillHasCategories = /\[\[Category:[^\]]*\]\]/.test(cleaned);
    const stillHasExternalLinks = /\[https?:\/\/[^\]]+\]/.test(cleaned);
    const stillHasInternalLinks = /\[\[[^\]]+\]\]/.test(cleaned);
    
    //     finalLength,
    //     reduction,
    //     reductionPercent: Math.round((reduction / originalLength) * 100),
    //     stillHasRelatedItems,
    //     stillHasReferences,
    //     stillHasLanguageLinks,
    //     stillHasCategories,
    //     stillHasExternalLinks,
    //     stillHasInternalLinks,
    //     contentEnd: cleaned.slice(-500)
    // });
    
    return cleaned;
}

// Load vector store from multiple compressed JSON parts
async function handleOnClickLoadData(elements) {
    debugLog('[DEBUG] handleOnClickLoadData start', { 
        isLoading, 
        embedder: !!embedder, 
        windowEmbedder: !!(window?.embedder),
        embedderType: typeof embedder,
        windowEmbedderType: typeof window?.embedder
    });
    
    // In test environment, also check window.embedder
    const actualEmbedder = embedder || window?.embedder;
    
    if (isLoading || !actualEmbedder) {
        if (!actualEmbedder) {
            alert('Embedding model not ready yet. Please wait for initialization.');
        }
        return;
    }
    
    // Synchronize embedder variable within module
    if (!embedder && window?.embedder) {
        embedder = window.embedder;
        debugLog('[DEBUG] Synchronized embedder variable with window.embedder');
    }
    
    debugLog('[DEBUG] Starting data loading');
    isLoading = true;
    elements.loadDataBtn.disabled = true;
    elements.loadingProgress.classList.add('loading');
    
    // Calculate total progress steps
    debugLog('[DEBUG] Starting metadata retrieval:', CONFIG.VECTOR_STORE_META_PATH);
    const metaResponse = await fetch(CONFIG.VECTOR_STORE_META_PATH);
    if (!metaResponse.ok) {
        throw new Error(`Failed to load metadata: ${metaResponse.status}`);
    }
    const metadata = await metaResponse.json();
    debugLog('[DEBUG] Metadata retrieval completed:', metadata);
    
    // Calculate total steps: metadata(1) + jsonl(1) + vector parts + title parts
    let totalSteps = 1; // metadata
    if (CONFIG.JSONL_GZ_PATH) totalSteps += 1; // JSONL
    totalSteps += metadata.num_parts; // vector store parts
    
    debugLog('[DEBUG] Calculating total steps:', { totalSteps, num_parts: metadata.num_parts });
    
    // Check if title store exists to add to total
    let titleMetadata = null;
    try {
        const titleMetaPath = CONFIG.VECTOR_STORE_META_PATH.replace('vector_store_meta.json', 'vector_store_titles_meta.json');
        const titleMetaResponse = await fetch(titleMetaPath);
        if (titleMetaResponse.ok) {
            titleMetadata = await titleMetaResponse.json();
            totalSteps += titleMetadata.num_parts;
        }
    } catch (error) {
        // Title store not available
    }
    
    let currentStep = 0;
    
    // Helper function to update progress bar
    const updateProgress = () => {
        const percentage = Math.round((currentStep / totalSteps) * 100);
        elements.loadingProgress.style.setProperty('--progress', `${percentage}%`);
    };
    
    elements.loadingStatus.textContent = 'Loading metadata...';
    updateProgress();
    
    try {
        // Metadata already loaded above
        currentStep++;
        updateProgress();
        
        // Load compressed JSONL file if configured
        if (CONFIG.JSONL_GZ_PATH) {
            elements.loadingStatus.textContent = 'Loading JSONL data...';
            
            try {
                await loadCompressedJSONL(CONFIG.JSONL_GZ_PATH, (progress, status) => {
                    // Show intermediate progress within JSONL loading
                    const jsonlProgress = Math.round((currentStep + progress / 100) / totalSteps * 100);
                    elements.loadingProgress.style.setProperty('--progress', `${jsonlProgress}%`);
                    elements.loadingStatus.textContent = status;
                });
                currentStep++;
                updateProgress();
            } catch (error) {
                //console.warn('Failed to load JSONL data:', error);
                currentStep++;
                updateProgress();
                // Continue without JSONL - will use embedded content from vector store
            }
        }
        
        // Load all parts
        const parts = [];
        let titleParts = [];
        
        debugLog('[DEBUG] Starting vector store part loading:', metadata.num_parts);
        
        for (let partIndex = 1; partIndex <= metadata.num_parts; partIndex++) {
            const loadingMessage = CONFIG.IS_LOCAL_ACCESS ? 
                `Loading part ${partIndex}/${metadata.num_parts} by local...` :
                `Loading part ${partIndex}/${metadata.num_parts}...`;
            elements.loadingStatus.textContent = loadingMessage;
            
            const partPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE.replace('{}', String(partIndex).padStart(2, '0'));
            //console.log(`[DEBUG] Starting part ${partIndex} loading:`, partPath);
            
            const response = await fetch(partPath);
            if (!response.ok) {
                //console.log(`[DEBUG] Part ${partIndex} fetch failed:`, response.status);
                throw new Error(`Failed to load part ${partIndex}: ${response.status}`);
            }
            
            //console.log(`[DEBUG] Part ${partIndex} fetch complete, starting decompression`);
            const arrayBuffer = await response.arrayBuffer();
            const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
            const partData = JSON.parse(decompressed);
            //console.log(`[DEBUG] Part ${partIndex} parse complete:`, { documents: partData.documents?.length });
            
            parts.push(partData);
            
            // Update progress after each part is loaded
            currentStep++;
            updateProgress();
        }
        
        // Try to load title vector store metadata and parts
        try {
            if (titleMetadata) {
                elements.loadingStatus.textContent = `Loading title vector store (${titleMetadata.num_parts} parts)...`;
                
                // Load title parts sequentially to show progress
                for (let partIndex = 1; partIndex <= titleMetadata.num_parts; partIndex++) {
                    elements.loadingStatus.textContent = `Loading title part ${partIndex}/${titleMetadata.num_parts}...`;
                    
                    const titlePartPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE
                        .replace('vector_store_part', 'vector_store_titles_part')
                        .replace('{}', String(partIndex).padStart(2, '0'));
                    
                    try {
                        const response = await fetch(titlePartPath);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
                            const titlePartData = JSON.parse(decompressed);
                            titleParts.push(titlePartData);
                        }
                    } catch (error) {
                        //console.warn(`Failed to load title part ${partIndex}:`, error);
                    }
                    
                    // Update progress after each title part is loaded
                    currentStep++;
                    updateProgress();
                }
                
                if (titleParts.length > 0) {
                    
                    // Debug: Count total documents in title parts
                    let totalTitleDocs = 0;
                    titleParts.forEach((part, index) => {
                        const docCount = part.documents ? part.documents.length : 0;
                        totalTitleDocs += docCount;
                    });
                } else {
                    //console.warn('🎯 No title parts loaded successfully');
                }
            }
        } catch (error) {
            //console.warn('Title vector store not available, using fallback search:', error);
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
                
                // Use multilingual MPNet-base-v2 model directly (768 dimensions, no preprocessing needed)
                
                // Get query embedding
                const output = await embedder(query, { pooling: 'mean', normalize: true });
                const queryEmbedding = Array.from(output.data);
                
                // Debug output for embedding comparison
                const embeddingNorm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
                //    query: query,
                //    dimensions: queryEmbedding.length,
                //    l2_norm: embeddingNorm.toFixed(6),
                //    first_5: queryEmbedding.slice(0, 5).map(x => x.toFixed(6)),
                //    last_5: queryEmbedding.slice(-5).map(x => x.toFixed(6)),
                //    full_embedding: queryEmbedding
                //});
                
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
                    preliminaryResults.push(...partResult);
                }
                
                // Phase 2: Final ranking of all preliminary results
                preliminaryResults.sort((a, b) => b.score - a.score);
                const finalResults = preliminaryResults.slice(0, k);
                
                
                // Enrich results with content from XML if available
                const enrichedResults = finalResults.map(doc => {
                    if (xmlIndex && doc.curid) {
                        const pageData = getPageFromXML(doc.curid);
                        if (pageData) {
                            // For chunks, check document size and provide appropriate content
                            if (doc.chunk_index !== undefined && doc.chunk_start !== undefined && doc.chunk_end !== undefined) {
                                let content;
                                
                                //    fullContentLength: pageData.content.length,
                                //    chunkStart: doc.chunk_start,
                                //    chunkEnd: doc.chunk_end,
                                //    curid: doc.curid
                                //});
                                
                                // Always use full content - no size limitation
                                content = pageData.content;
                                
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
                                //    fullContentLength: pageData.content.length,
                                //    curid: doc.curid,
                                //    contentPreview: pageData.content.substring(0, 100) + '...'
                                //});
                                
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
                    enrichedResults.forEach((doc, i) => {
                        const docId = doc.curid || doc.metadata?.curid || doc.metadata?.id || doc.id;
                        const curid = doc.curid || doc.metadata?.curid;
                        const title = doc.metadata ? doc.metadata.title : 'Unknown';
                        // if (i < 2) {  // Only show detailed info for first 2 chunks to avoid spam
                        // }
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
                            } else if (!group.bestChunk) {
                                // Ensure we have at least one bestChunk even if scores are equal
                                group.bestChunk = doc;
                            }
                        }
                    }
                    
                    // Convert to array and sort by max score
                    const documentArray = Array.from(documentGroups.values());
                    documentArray.sort((a, b) => b.maxScore - a.maxScore);
                    
                    documentArray.slice(0, 5).forEach((group, i) => {
                        const bestChunkLength = group.bestChunk?.content?.length || 0;
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
                                //console.error(`🎯 Error processing embedding for doc ${docIndex}:`, error);
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
                            
                            // Debug log for specific document (Pair Sequence Halting Problem)
                            if (doc.curid === "3659" || (doc.metadata && doc.metadata.curid === "3659")) {
                            }
                            // Debug log for Graham number
                            if (doc.curid === "345" || (doc.metadata && doc.metadata.curid === "345")) {
                                const xmlPageData = getPageFromXML(doc.curid);
                                // Decode embedding from binary if not already done
                                let docEmbedding;
                                if (doc.embedding_binary && doc.embedding_format === 'float32_base64') {
                                    docEmbedding = Array.from(base64ToFloat32Array(doc.embedding_binary));
                                } else if (doc.embedding && Array.isArray(doc.embedding)) {
                                    docEmbedding = doc.embedding;
                                } else {
                                    return;
                                }
                            }
                            
                            // Debug high-score pages
                            if ([809, 810, 9537, 9538, 9539, 9540, 9541].includes(parseInt(doc.curid)) && titleSimilarity > 0.8) {
                                const xmlPageData = getPageFromXML(doc.curid);
                                // Decode embedding from binary if not already done
                                let docEmbedding;
                                if (doc.embedding_binary && doc.embedding_format === 'float32_base64') {
                                    docEmbedding = Array.from(base64ToFloat32Array(doc.embedding_binary));
                                } else if (doc.embedding && Array.isArray(doc.embedding)) {
                                    docEmbedding = doc.embedding;
                                } else {
                                    return;
                                }
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
                
                // Debug: Show top 10 results
                for (let i = 0; i < Math.min(10, titleSimilarities.length); i++) {
                    const result = titleSimilarities[i];
                    const xmlPageData = getPageFromXML(result.curid);
                    const title = xmlPageData?.title || result.metadata?.title || 'No title';
                }
                
                const topTitleResults = titleSimilarities.slice(0, k);
                
                // Format title results similar to body results with XML content enrichment
                return topTitleResults.map(doc => {
                    let content = doc.content; // Default to vector store content
                    let enrichedWithXML = false;
                    
                    //     id: doc.id, 
                    //     curid: doc.curid, 
                    //     metadataId: doc.metadata?.id,
                    //     title: doc.metadata?.title,
                    //     hasXmlData: !!xmlData,
                    //     originalContentLength: doc.content?.length || 0,
                    //     originalContent: (doc.content?.substring(0, 50) || 'No content') + '...'
                    // });
                    
                    // Try to get curid from different sources
                    const curid = doc.curid || doc.metadata?.curid || doc.metadata?.id;
                    
                    // Enrich with XML content if available
                    if (xmlIndex && curid) {
                        const pageData = getPageFromXML(curid);
                        if (pageData) {
                            content = pageData.content; // Use full XML content for title results
                            enrichedWithXML = true;
                        } else {
                        }
                    } else {
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
                    if (xmlIndex && curid) {
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
                    
                    //     title: result.title,
                    //     contentLength: result.content.length,
                    //     enrichedWithXML: enrichedWithXML,
                    //     contentPreview: result.content.substring(0, 100) + '...'
                    // });
                    
                    return result;
                });
            }
        };
        
        elements.loadingStatus.textContent = 'Data loaded successfully';
        
        // Test mode: Synchronize vectorStore to window for test environment access
        if (TEST_MODE && typeof window !== 'undefined') {
            window.vectorStore = vectorStore;
        }
        
        // Update error messages after vector store is loaded
        checkAndShowErrors(elements);
        
    } catch (error) {
        //console.error('Error loading vector store:', error);
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
        errors.push('Please configure LLM API with the above settings');
    }
    
    // Check vector store
    if (!vectorStore) {
        errors.push('Please load data with the above settings');
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
function handleOnClickSend(elements) {
    const query = elements.promptWindow.value.trim();
    if (!query) {
        return;
    }
    
    // Save query to localStorage for next page load
    try {
        elements.localStorage.setItem('lastQuery', query);
    } catch (error) {
        //console.warn('Could not save query to localStorage:', error);
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

// Extract search keywords from query using LLM
async function extractSearchKeywords(query, apiKey, elements) {
    const baseUrl = elements.baseUrl.value.trim();
    const modelName = elements.modelSelect.value.trim();
    
    const keywordPrompt = `
You are a keyword extraction expert specialized in googology search systems.

Extract the most important technical terms (maximum 5) from the following user query for googology RAG search.

User Query: "${query}"

Extraction Rules:
1. Extract only technical terms and proper nouns from googology, mathematics, and computer science
2. Prioritize the following types of technical terms:
   - Large number names (Graham's number, Fish numbers, BM2.2, TREE(3), etc.)
   - Mathematical notations/systems (Bashicu matrix, Ackermann function, Veblen hierarchy, etc.)
   - Person names (Bashicu, Fish, Graham, etc.)
   - Mathematical concepts (ordinals, transfinite, hierarchy, etc.)
3. Exclude general words:
   - Question words (what, about, why, how, difference, comparison)
   - General nouns (algorithm, system, number, calculation, definition, theory)
   - Verbs/adjectives (large, small, create, calculate)
4. Preserve alphanumeric technical symbols/abbreviations (BM2.2, TREE(3), φ(Ω,0), etc.)
5. Extract 1-5 keywords

Output in the following JSON format:
{
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

No explanation needed, JSON only.`;

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{
                    role: 'user',
                    content: keywordPrompt
                }],
                temperature: 0.1,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        
        if (!content) {
            //console.warn('No content received from LLM for keyword extraction');
            return {
                keywords: [query],
                prompt: keywordPrompt,
                response: 'No content received from LLM'
            }; // Fallback to original query
        }

        try {
            // Remove code block markers if present
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```json') && cleanContent.endsWith('```')) {
                cleanContent = cleanContent.slice(7, -3).trim();
            } else if (cleanContent.startsWith('```') && cleanContent.endsWith('```')) {
                cleanContent = cleanContent.slice(3, -3).trim();
            }
            
            const parsed = JSON.parse(cleanContent);
            const keywords = parsed.keywords || [query];
            return {
                keywords: keywords,
                prompt: keywordPrompt,
                response: content
            };
        } catch (parseError) {
            //console.warn('Failed to parse LLM response for keywords:', content);
            return {
                keywords: [query],
                prompt: keywordPrompt,
                response: content
            }; // Fallback to original query
        }
    } catch (error) {
        //console.error('Error extracting keywords:', error);
        return {
            keywords: [query],
            prompt: keywordPrompt,
            response: `Error: ${error.message}`
        }; // Fallback to original query
    }
}

// Perform multi-keyword search and merge results
async function performMultiKeywordSearch(keywords) {
    
    const allBodyResults = [];
    const allTitleResults = [];
    const seenBodyDocs = new Set();
    const seenTitleDocs = new Set();
    
    // Search for each keyword
    for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        
        try {
            const searchResults = await vectorStore.search(keyword);
            
            // Merge body results with deduplication
            for (const result of searchResults.bodyResults) {
                const docId = result.curid || result.id;
                if (!seenBodyDocs.has(docId)) {
                    seenBodyDocs.add(docId);
                    // Add keyword source for debugging
                    result.sourceKeyword = keyword;
                    allBodyResults.push(result);
                }
            }
            
            // Merge title results with deduplication
            for (const result of searchResults.titleResults) {
                const docId = result.curid || result.id;
                if (!seenTitleDocs.has(docId)) {
                    seenTitleDocs.add(docId);
                    // Add keyword source for debugging
                    result.sourceKeyword = keyword;
                    allTitleResults.push(result);
                }
            }
            
        } catch (error) {
            console.error(`Error searching keyword "${keyword}":`, error);
        }
    }
    
    // Sort by score and take top results
    allBodyResults.sort((a, b) => b.score - a.score);
    allTitleResults.sort((a, b) => b.score - a.score);
    
    const topBodyResults = allBodyResults.slice(0, 10);
    const topTitleResults = allTitleResults.slice(0, 10);
    
    
    // Debug: Show sources of top results
    topBodyResults.forEach((result, i) => {
    });
    
    topTitleResults.forEach((result, i) => {
    });
    
    return {
        bodyResults: topBodyResults,
        titleResults: topTitleResults
    };
}

// Actual processing function
// Dynamic prompt size calculation based on available documents
function calculateRequiredTokens(titleResults, bodyResults, prompt_document_num, prompt_document_num_body, userQuery, elements) {
    // System prompt template (rough estimate)
    const systemPromptTemplate = `You are an AI assistant specialized in "Large Number Theory". Please answer user questions accurately and in detail based on the following context information.

## Title Search Results

## Related Articles and Content

User Question: `;
    
    let estimatedContextSize = 0;
    
    // Calculate title section size
    if (prompt_document_num > 0) {
        const headerSize = "## Title Search Results\n\n".length;
        estimatedContextSize += headerSize;
        
        for (let i = 0; i < prompt_document_num; i++) {
            const result = titleResults[i];
            if (!result) continue;
            
            const processedResult = processSearchResultContent(result, i + 1, elements, "title");
            if (!processedResult || !processedResult.llmContent) {
                console.error(`❌ Title processing failed for result ${i + 1}:`, result);
                continue;
            }
            const llmContent = processedResult.llmContent;
            const docSize = llmContent.length + `### [${i + 1}] `.length + result.title.length + "\n\n".length;
            estimatedContextSize += docSize;
        }
    }
    
    // Add section separator
    if (prompt_document_num > 0 && prompt_document_num_body > 0) {
        estimatedContextSize += "\n\n".length;
    }
    
    // Calculate body section size
    if (prompt_document_num_body > 0) {
        const headerSize = "## Related Articles and Content\n\n".length;
        estimatedContextSize += headerSize;
        
        for (let i = 0; i < prompt_document_num_body; i++) {
            const result = bodyResults[i];
            if (!result) continue;
            
            const processedResult = processSearchResultContent(result, prompt_document_num + i + 1, elements, "body");
            if (!processedResult || !processedResult.llmContent) {
                console.error(`❌ Body processing failed for result ${i + 1}:`, result);
                continue;
            }
            const llmContent = processedResult.llmContent;
            const docSize = llmContent.length + `### [${prompt_document_num + i + 1}] `.length + result.title.length + "\n\n".length;
            estimatedContextSize += docSize;
        }
    }
    
    const totalSystemPromptSize = systemPromptTemplate.length + estimatedContextSize;
    return totalSystemPromptSize + userQuery.length;
}

function findOptimalDocumentNumbers(titleResults, bodyResults, userQuery, tokenLimit, elements) {
    const maxDocs = Math.min(titleResults.length, bodyResults.length);
    
    // Create token_size[prompt_document_num] table
    const token_size = {};
    
    // Build the token size table for all possible prompt_document_num values
    for (let prompt_document_num = maxDocs; prompt_document_num >= 1; prompt_document_num--) {
        const requiredTokens = calculateRequiredTokens(
            titleResults, bodyResults, prompt_document_num, prompt_document_num, userQuery, elements
        );
        
        token_size[prompt_document_num] = requiredTokens;
        
        if (requiredTokens <= tokenLimit) {
            return {
                titleDocNum: prompt_document_num,
                bodyDocNum: prompt_document_num,
                estimatedTokens: requiredTokens,
                withinLimit: true,
                tokenSizeTable: token_size,
                maxAvailableDocs: maxDocs
            };
        }
    }
    return {
        titleDocNum: 1,
        bodyDocNum: 1,
        estimatedTokens: token_size[1],
        withinLimit: false,
        tokenSizeTable: token_size,
        maxAvailableDocs: maxDocs
    };
}

async function processSearchAndResponse(elements, query) {
    // At this point, all validations should already pass since send button is only enabled when ready
    const apiKey = elements.apiKey.value.trim();
    
    try {
        let keywordExtractionResult;
        let searchResults;
        
        if (SKIP_LLM_KEYWORD_EXTRACTION) {
            // Skip LLM keyword extraction, use query directly
            elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Searching documents directly...';
            keywordExtractionResult = {
                keywords: [query],
                prompt: 'Direct search (no LLM keyword extraction)',
                response: 'Skipped LLM keyword extraction'
            };
            searchResults = await performMultiKeywordSearch([query]);
        } else {
            // Step 1: Extract keywords from query using LLM
            elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Extracting search keywords...';
            keywordExtractionResult = await extractSearchKeywords(query, apiKey, elements);
            
            // Step 2: Perform multi-keyword search
            elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Searching documents with multiple keywords...';
            searchResults = await performMultiKeywordSearch(keywordExtractionResult.keywords);
        }
        
        displayRAGResults(elements, searchResults.bodyResults, searchResults.titleResults);
        
        // Step 3: Generate AI response using merged results
        await generateAIResponse(elements, query, searchResults.bodyResults, searchResults.titleResults, apiKey, keywordExtractionResult);
        
    } catch (error) {
        //console.error('Error during search:', error);
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
            const { displayContent } = processSearchResultContent(result, refNumber, elements, 'title', null, 1000);
            
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
            const { displayContent } = processSearchResultContent(result, refNumber, elements, 'body', null, 1000);
            
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
function displayLLMPrompt(systemPrompt, userQuery, elements, promptSize = null, keywordExtractionResult = null) {
    
    if (SHOW_LLM_PROMPT && elements.debugSection && elements.debugInfoContent && elements.systemPromptContent && elements.userQueryContent) {
        
        // Build debug information sections
        let debugInfo = '';
        
        // Add keyword extraction information if available
        if (keywordExtractionResult) {
            debugInfo += `=== KEYWORD EXTRACTION ===
Extracted Keywords: ${JSON.stringify(keywordExtractionResult.keywords)}

--- Keyword Extraction Prompt ---
${keywordExtractionResult.prompt}

--- LLM Response ---
${keywordExtractionResult.response}
===============================

`;
        }
        
        // Add dynamic document selection info if available
        if (elements.window.lastDocumentSelection) {
            const info = elements.window.lastDocumentSelection;
            debugInfo += `=== DYNAMIC DOCUMENT SELECTION ===
Selected prompt_document_num: ${info.selectedPromptDocumentNum}
Token-based optimization: ${info.estimatedTokens && CHARS_PER_TOKEN ? Math.round(info.estimatedTokens / CHARS_PER_TOKEN).toLocaleString() : 'N/A'} tokens, ${info.estimatedTokens ? info.estimatedTokens.toLocaleString() : 'N/A'} chars
Documents per type: Title ranking top ${info.selectedPromptDocumentNum}, Body ranking top ${info.selectedPromptDocumentNum}
Available: ${info.availableTitleDocs} title results, ${info.availableBodyDocs} body results (max possible: ${info.maxPossibleDocs})
Model: ${info.model}, Token limit: ${info.tokenLimit.toLocaleString()} chars
===================================

`;
        }
        
        // Add prompt size information if available
        if (promptSize !== null) {
            debugInfo += `=== PROMPT SIZE INFO ===
Total characters: ${promptSize.toLocaleString()}
System prompt: ${systemPrompt.length.toLocaleString()}
User query: ${userQuery.length.toLocaleString()}
========================

`;
        }
        
        // Display debug info in separate section
        elements.debugInfoContent.innerHTML = `<pre>${debugInfo}</pre>`;
        
        // Display only the actual system prompt (without debug info)
        elements.systemPromptContent.textContent = systemPrompt;
        elements.userQueryContent.textContent = userQuery;
        elements.debugSection.style.display = 'block';
    } else if (elements.debugSection) {
        elements.debugSection.style.display = 'none';
    }
}

// Generate AI response using OpenAI API
async function generateAIResponse(elements, query, bodyResults, titleResults, apiKey, keywordExtractionResult = null) {
    let promptSizeWarning = '';
    
    try {
        const baseUrl = elements.baseUrl.value.trim();
        const currentModel = getCurrentModel(elements);
        const tokenLimit = getPromptSizeLimit(currentModel);
        
        // Dynamic document adjustment
        const optimalDocs = findOptimalDocumentNumbers(titleResults, bodyResults, query, tokenLimit, elements);
        const selectedTitleResults = titleResults.slice(0, optimalDocs.titleDocNum);
        const selectedBodyResults = bodyResults.slice(0, optimalDocs.bodyDocNum);
        
        // Store document selection info for display
        elements.window.lastDocumentSelection = {
            model: currentModel,
            tokenLimit: tokenLimit,
            availableTitleDocs: titleResults.length,
            availableBodyDocs: bodyResults.length,
            maxPossibleDocs: optimalDocs.maxAvailableDocs,
            selectedPromptDocumentNum: optimalDocs.titleDocNum,
            estimatedTokens: optimalDocs.estimatedTokens,
            withinLimit: optimalDocs.withinLimit,
            tokenSizeTable: optimalDocs.tokenSizeTable
        };
        
        // Create numbered references for citations (same order as display)
        let citationNumber = 1;
        const citations = [];
        
        
        // Create context from title results first (starting from 1)
        const titleContext = selectedTitleResults.map(result => {
            const refNumber = citationNumber++;
            citations.push({
                number: refNumber,
                title: result.title,
                url: result.url,
                type: 'title'
            });
            
            // Use common processing function
            const { llmContent } = processSearchResultContent(result, refNumber, elements, 'title');
            
            return `[${refNumber}] **${result.title}**\n${llmContent}`;
        }).join('\n\n');
        
        // Create context from body results (continuing the numbering)
        const bodyContext = selectedBodyResults.map(result => {
            const refNumber = citationNumber++;
            citations.push({
                number: refNumber,
                title: result.title,
                url: result.url,
                type: 'body'
            });
            
            // Use common processing function
            const { llmContent } = processSearchResultContent(result, refNumber, elements, 'body');
            
            return `[${refNumber}] **${result.title}**\n${llmContent}`;
        }).join('\n\n');
        
        // Combine both contexts
        let combinedContext = '';
        if (selectedTitleResults.length > 0) {
            combinedContext += 'Title-based relevant documents:\n' + titleContext;
        }
        if (selectedBodyResults.length > 0) {
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

        
        // Check prompt size limit using dynamic model-based limits
        const totalPromptSize = systemPrompt.length + query.length;
        const selectedModel = (elements.modelSelect?.value) || CONFIG.DEFAULT_MODEL;
        const dynamicLimit = getPromptSizeLimit(selectedModel);
        
        //    model: currentModel,
        //    systemPromptLength: systemPrompt.length,
        //    queryLength: query.length,
        //    totalSize: totalPromptSize,
        //    staticLimit: PROMPT_SIZE_LIMIT,
        //    dynamicLimit: dynamicLimit,
        //    withinDynamicLimit: totalPromptSize <= dynamicLimit,
        //    combinedContextLength: combinedContext.length,
        //    exceedsBy: totalPromptSize - dynamicLimit
        //});
        
        if (totalPromptSize > dynamicLimit) {
            promptSizeWarning = ` Warning: Prompt size (${totalPromptSize}) exceeds ${currentModel} limit (${dynamicLimit}). OpenAI will likely reject this with Error 400.`;
            //console.warn(`Prompt size (${totalPromptSize}) exceeds ${currentModel} limit (${dynamicLimit}). OpenAI will likely reject this with Error 400.`);
            // Note: We continue with the full context but log the warning.
            // The cleaning should have reduced the size significantly.
        }
        
        // Display LLM prompt in debug section with size information
        displayLLMPrompt(systemPrompt, query, elements, totalPromptSize, keywordExtractionResult);
        
        // Debug: Log the first 500 characters of the context to verify citation numbers are included
        if (combinedContext.length > 0) {
        }

        // Call the appropriate LLM API based on selected model
        const aiResponse = await callLLMAPI(baseUrl, apiKey, currentModel, systemPrompt, query, elements);
        
        // Display the response
        let responseHTML = `<div class="ai-response">${aiResponse.replace(/\n/g, '<br>')}</div>`;
        
        // Set response content and trigger MathJax rendering
        elements.responseWindow.innerHTML = responseHTML;
        
        // Re-display RAG results to include LLM prompt if debug flag is enabled
        displayRAGResults(elements, bodyResults, titleResults);
        
        // Re-render MathJax for the new content
        if (elements.window.MathJax && elements.window.MathJax.typesetPromise) {
            elements.window.MathJax.typesetPromise([elements.responseWindow]).catch((err) => {
                //console.warn('MathJax rendering error:', err);
            });
        } else if (elements.window.MathJax && elements.window.MathJax.Hub) {
            // Fallback for older MathJax versions
            elements.window.MathJax.Hub.Queue(["Typeset", elements.window.MathJax.Hub, elements.responseWindow]);
        } else {
            //console.warn('MathJax not properly initialized or typesetPromise unavailable');
            //    exists: !!window.MathJax,
            //    typesetPromise: !!(window.MathJax && window.MathJax.typesetPromise),
            //    Hub: !!(window.MathJax && window.MathJax.Hub),
            //    startup: !!(window.MathJax && window.MathJax.startup)
            //});
        }
        
    } catch (error) {
        //console.error('Error generating AI response:', error);
        
        // Get dynamic limit for error analysis
        const errorModel = (elements.modelSelect?.value) || CONFIG.DEFAULT_MODEL;
        const dynamicLimit = getPromptSizeLimit(errorModel);
        
        // Log full error details for analysis
        
        // Check for rate limit errors (status 429)
        if (error.response && error.response.status === 429) {
            
            const provider = getProviderFromModel(currentModel);
            const providerName = PROVIDER_CONFIG[provider]?.name || 'API';
            
            let waitTime = 60; // Default fallback
            let rateLimitMessage = 'Rate limit reached';
            
            // Try to extract details from error response body
            if (error.response.body) {
                
                // Look for wait time in the response body
                const waitTimeMatch = error.response.body.match(/Please try again in ([\d.]+)s/);
                if (waitTimeMatch) {
                    waitTime = parseFloat(waitTimeMatch[1]);
                }
                
                // Try to parse as JSON to get structured error info
                try {
                    const errorData = JSON.parse(error.response.body);
                    if (errorData.error && errorData.error.message) {
                        rateLimitMessage = errorData.error.message;
                        // Also try to extract wait time from structured message
                        const structuredWaitMatch = rateLimitMessage.match(/Please try again in ([\d.]+)s/);
                        if (structuredWaitMatch) {
                            waitTime = parseFloat(structuredWaitMatch[1]);
                        }
                    }
                } catch (parseError) {
                    rateLimitMessage = error.response.body;
                }
            }
            
            elements.responseWindow.innerHTML = `
                <div class="error rate-limit-error">
                    <h3>⏳ ${providerName} API Rate Limit Reached</h3>
                    <p>Please retry after <strong>${Math.ceil(waitTime)} seconds</strong>.</p>
                    <p>Rate limits may be reached due to the use of large prompts for high-quality responses.</p>
                    <details>
                        <summary>Detailed Error Information</summary>
                        <pre>${rateLimitMessage}</pre>
                    </details>
                </div>
            `;
            return;
        }
        
        if (error.response) {
            if (error.response.data) {
            }
            
            // Try to extract actual token limit from OpenAI error response
            const extractedLimit = extractTokenLimitFromError(error.response.body);
            if (extractedLimit) {
                // Could potentially update limits dynamically here
            }
        }
        
        // Build detailed error message
        let errorMessage = `Failed to generate response: ${error.message}`;
        
        // Add detailed error information if available
        if (error.response) {
            errorMessage += `<br><strong>Status:</strong> ${error.response.status} ${error.response.statusText}`;
            
            // Try to parse error body for more details
            if (error.response.body) {
                try {
                    const errorData = JSON.parse(error.response.body);
                    if (errorData.error) {
                        errorMessage += `<br><strong>Error:</strong> ${errorData.error.message || errorData.error}`;
                        if (errorData.error.type) {
                            errorMessage += `<br><strong>Type:</strong> ${errorData.error.type}`;
                        }
                        if (errorData.error.code) {
                            errorMessage += `<br><strong>Code:</strong> ${errorData.error.code}`;
                        }
                    }
                } catch (parseError) {
                    // If not JSON, show raw error body (truncated)
                    const truncatedBody = error.response.body.length > 200 
                        ? error.response.body.substring(0, 200) + '...' 
                        : error.response.body;
                    errorMessage += `<br><strong>Details:</strong> ${truncatedBody}`;
                }
            }
        }
        
        elements.responseWindow.innerHTML = `<p class="error">${errorMessage}${promptSizeWarning}</p>`;
    }
}

// Save settings to localStorage
function saveSettingsToLocalStorage(elements) {
    try {
        const settings = {
            baseUrl: elements.baseUrl.value.trim(),
            model: (elements.modelSelect?.value) || CONFIG.DEFAULT_MODEL
        };
        elements.localStorage.setItem('ragSettings', JSON.stringify(settings));
    } catch (error) {
        //console.warn('Could not save settings to localStorage:', error);
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage(elements) {
    try {
        const savedSettings = elements.localStorage.getItem('ragSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.baseUrl) {
                elements.baseUrl.value = settings.baseUrl;
            }
            if (settings.model && elements.modelSelect) {
                elements.modelSelect.value = settings.model;
            }
            return true;
        }
    } catch (error) {
        //console.warn('Could not restore settings from localStorage:', error);
    }
    return false;
}

// Initialize RAG system with given currentSite
async function handleOnLoad(currentSite) {
    // Initialize environment-specific dependencies first
    await initializeDependencies();
    
    // Get DOM elements and browser objects
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
        errorMessages: document.getElementById('error-messages'),
        licenseLink: document.getElementById('license-link'),
        fetchDate: document.getElementById('fetch-date'),
        debugSection: document.getElementById('llm-prompt-debug-section'),
        debugInfoContent: document.getElementById('debug-info-content'),
        systemPromptContent: document.getElementById('system-prompt-content'),
        userQueryContent: document.getElementById('user-query-content'),
        apiConfigForm: document.getElementById('api-config-form'),
        apiKeyHelp: document.getElementById('api-key-help'),
        // Browser objects
        window: window,
        document: document,
        localStorage: localStorage
    };
    
    // Load configuration first
    await loadConfig(currentSite, elements);
    
    // Update license information now that we have elements
    if (CONFIG.FULL_CONFIG) {
        updateLicenseInfo(CONFIG.FULL_CONFIG, elements);
    }
    
    // Try to load saved settings from localStorage, otherwise use defaults
    const settingsLoaded = loadSettingsFromLocalStorage(elements);
    if (!settingsLoaded) {
        // Set default API URL and model only if no saved settings
        elements.baseUrl.value = CONFIG.DEFAULT_API_URL;
        if (elements.modelSelect) {
            elements.modelSelect.value = CONFIG.DEFAULT_MODEL;
        }
    }
    
    // Initialize the embedding pipeline for retrieval
    elements.loadingStatus.textContent = 'Initializing embedding model...';
    
    try {
        debugLog('[DEBUG] pipelineImport start:', typeof pipelineImport);
        const { pipeline } = await pipelineImport();
        debugLog('[DEBUG] pipeline retrieval complete:', typeof pipeline);
        
        debugLog('[DEBUG] embedder initialization start:', CONFIG.EMBEDDING_MODEL);
        embedder = await pipeline('feature-extraction', CONFIG.EMBEDDING_MODEL);
        debugLog('[DEBUG] embedder initialization complete:', typeof embedder);
        
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
            //console.warn('[DEBUG] Could not load metadata for size info:', error);
            elements.loadingStatus.textContent = 'Embedding model ready - click "Load Data"';
        }
    } catch (error) {
        //console.error('[DEBUG] Failed to initialize embedding pipeline:', error);
        //console.error('[DEBUG] Error details:', error.message, error.stack);
        elements.loadingStatus.textContent = 'Failed to initialize embedding model';
    }
    
    // Event listeners
    elements.loadDataBtn.addEventListener('click', () => handleOnClickLoadData(elements));
    elements.sendBtn.addEventListener('click', () => {
        if (!elements.sendBtn.disabled) {
            handleOnClickSend(elements);
        }
    });
    elements.promptWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !elements.sendBtn.disabled) {
            handleOnClickSend(elements);
        }
    });
    
    // Listen for input changes to update error messages and save settings
    elements.baseUrl.addEventListener('input', () => {
        checkAndShowErrors(elements);
        saveSettingsToLocalStorage(elements);
    });
    if (elements.modelSelect) {
        elements.modelSelect.addEventListener('change', () => {
            updateUIForProvider(elements);
            checkAndShowErrors(elements);
            saveSettingsToLocalStorage(elements);
        });
    }
    elements.apiKey.addEventListener('input', () => checkAndShowErrors(elements));
    
    // Restore last query from localStorage
    try {
        const lastQuery = elements.localStorage.getItem('lastQuery');
        if (lastQuery && lastQuery.trim()) {
            elements.promptWindow.value = lastQuery;
        }
    } catch (error) {
        //console.warn('Could not restore query from localStorage:', error);
    }
    
    // Prevent form submission (for password manager compatibility only)
    if (elements.apiConfigForm) {
        elements.apiConfigForm.addEventListener('submit', (e) => {
            e.preventDefault();
            return false;
        });
    }
    
    // Single delayed check for initial error display
    setTimeout(() => {
        updateUIForProvider(elements);
        checkAndShowErrors(elements);
    }, 1000);
}

// Claude API call function
async function callClaudeAPI(baseUrl, apiKey, model, systemPrompt, userQuery) {
    const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [
                { role: 'user', content: userQuery }
            ],
            system: systemPrompt
        })
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Claude API request failed: ${response.status}`);
        error.response = {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        };
        throw error;
    }
    
    const data = await response.json();
    return data.content[0].text;
}

// OpenRouter API call function (OpenAI compatible)
async function callOpenRouterAPI(baseUrl, apiKey, model, systemPrompt, userQuery) {
    // Remove openrouter/ prefix for API call
    const actualModel = model.replace('openrouter/', '');
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': elements.window.location.origin,
            'X-Title': 'Googolbook LM RAG System'
        },
        body: JSON.stringify({
            model: actualModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuery }
            ],
            temperature: 0.3,
            max_tokens: 16000
        })
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`OpenRouter API request failed: ${response.status}`);
        error.response = {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        };
        throw error;
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// Gemini API call function
async function callGeminiAPI(baseUrl, apiKey, model, systemPrompt, userQuery) {
    const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `${systemPrompt}\n\nUser: ${userQuery}`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                maxOutputTokens: 4000
            }
        })
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Gemini API request failed: ${response.status}`);
        error.response = {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        };
        throw error;
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Azure OpenAI API call function
async function callAzureOpenAIAPI(baseUrl, apiKey, model, systemPrompt, userQuery) {
    // Extract deployment name from model (remove azure/ prefix)
    const deploymentName = model.replace('azure/', '');
    
    // Build Azure OpenAI endpoint URL with API version
    const apiVersion = '2024-10-21';
    const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuery }
            ],
            temperature: 0.3,
            max_tokens: 16000
        })
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Azure OpenAI API request failed: ${response.status}`);
        error.response = {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        };
        throw error;
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// OpenAI API call function (existing logic extracted)
async function callOpenAIAPI(baseUrl, apiKey, model, systemPrompt, userQuery) {
    const requestUrl = `${baseUrl}/chat/completions`;
    const requestBody = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ],
        temperature: 0.3,
        max_tokens: 16000
    };
    
    const requestLogData = {
        url: requestUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`
        },
        body: {
            model: requestBody.model,
            temperature: requestBody.temperature,
            max_tokens: requestBody.max_tokens,
            systemPromptLength: systemPrompt.length,
            userQueryLength: userQuery.length,
            systemPrompt: systemPrompt,
            userQuery: userQuery
        }
    };
    debugLog('[DEBUG] OpenAI API Request:');
    debugLog(JSON.stringify(requestLogData, null, 2));
    
    const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    
    const responseLogData = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries([...response.headers.entries()])
    };
    debugLog(`[DEBUG] OpenAI API Response - HTTP ${response.status} ${response.statusText}:`);
    debugLog(JSON.stringify(responseLogData, null, 2));
    
    if (!response.ok) {
        const errorBody = await response.text();
        debugLog(`[DEBUG] OpenAI API Error Response Body (HTTP ${response.status}):`);
        debugLog(errorBody);
        const error = new Error(`OpenAI API request failed: ${response.status}`);
        error.response = {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        };
        throw error;
    }
    
    const data = await response.json();
    const successLogData = {
        model: data.model,
        usage: data.usage,
        responseLength: data.choices?.[0]?.message?.content?.length || 0,
        responseContent: data.choices?.[0]?.message?.content
    };
    debugLog(`[DEBUG] OpenAI API Success Response (HTTP ${response.status}):`);
    debugLog(JSON.stringify(successLogData, null, 2));
    return data.choices[0].message.content;
}

// Universal API call function
async function callLLMAPI(baseUrl, apiKey, model, systemPrompt, userQuery, elements) {
    const provider = getProviderFromModel(model);
    
    switch (provider) {
        case 'claude':
            return await callClaudeAPI(baseUrl, apiKey, model, systemPrompt, userQuery);
        case 'gemini':
            return await callGeminiAPI(baseUrl, apiKey, model, systemPrompt, userQuery);
        case 'openrouter':
            return await callOpenRouterAPI(baseUrl, apiKey, model, systemPrompt, userQuery);
        case 'azure-openai':
            return await callAzureOpenAIAPI(baseUrl, apiKey, model, systemPrompt, userQuery);
        case 'openai':
        default:
            return await callOpenAIAPI(baseUrl, apiKey, model, systemPrompt, userQuery);
    }
}

// Update UI based on selected provider
function updateUIForProvider(elements) {
    const selectedModel = elements.modelSelect?.value || CONFIG.DEFAULT_MODEL;
    const provider = getProviderFromModel(selectedModel);
    const config = PROVIDER_CONFIG[provider];
    
    if (!config) return;
    
    // Update Base URL placeholder only (keep label as "API Base URL:")
    elements.baseUrl.placeholder = config.baseUrlPlaceholder;
    
    // Update API Key field
    elements.apiKey.placeholder = config.apiKeyPlaceholder;
    
    // Update API Key help text
    if (elements.apiKeyHelp) {
        elements.apiKeyHelp.innerHTML = config.apiKeyHelp;
    }
    
    // Update Base URL if it's still the default
    if (elements.baseUrl.value === '' || 
        elements.baseUrl.value === 'https://api.openai.com/v1' ||
        elements.baseUrl.value === 'https://api.anthropic.com/v1' ||
        elements.baseUrl.value === 'https://generativelanguage.googleapis.com/v1beta' ||
        elements.baseUrl.value === 'https://openrouter.ai/api/v1' ||
        elements.baseUrl.value === 'https://your-resource.openai.azure.com') {
        elements.baseUrl.value = config.baseUrl;
    }
}

// Export the initialization function and key handlers
export { handleOnLoad as initializeRAG, testURLCleaning, handleOnClickSend, handleOnClickLoadData };
