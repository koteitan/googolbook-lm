// RAG Common Module - Shared functionality across all sites
// Import Transformers.js for HuggingFace embeddings
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js';

// Import YAML parser
import { load as yamlLoad } from 'https://cdn.skypack.dev/js-yaml@4.1.0';

// Debug flag - set to true to show debug info in AI response
const SHOW_DEBUG_INFO = false;

// Show full chunk content in RAG results (same as what LLM sees)
const SHOW_FULL_RAG_CONTENT = true;

// Group search results by document and show top 10 documents (vs. top chunks)
const GROUP_BY_DOCUMENT = true;

// Limit for document size when sending to LLM (in characters)
const DOCUMENT_SIZE_LIMIT = 10000;

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

// Load configuration from YAML
async function loadConfig(currentSite) {
    try {
        const configPath = `./config.yml`;
        
        console.log('Loading configuration from:', configPath);
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        
        const yamlText = await response.text();
        const config = yamlLoad(yamlText);
        
        // Check if we're on a local address and auto_part_path is enabled
        const isLocalAccess = window.location.hostname === '127.0.0.1' || 
                             window.location.hostname === 'localhost' ||
                             window.location.hostname.startsWith('192.168.') ||
                             window.location.hostname.startsWith('10.') ||
                             window.location.hostname.startsWith('172.');
        
        const useLocalPath = config.web.vector_store.auto_part_path && isLocalAccess;
        const finalPartPathTemplate = useLocalPath ? 
            './vector_store_part{}.json.gz' : 
            config.web.vector_store.part_path_template;
        
        console.log(`Local access detected: ${isLocalAccess}, auto_part_path: ${config.web.vector_store.auto_part_path}, using local path: ${useLocalPath}`);
        
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
            IS_LOCAL_ACCESS: useLocalPath
        };
        
        console.log('Configuration loaded successfully:', CONFIG);
        console.log('VECTOR_STORE_META_PATH:', CONFIG.VECTOR_STORE_META_PATH);
        console.log('VECTOR_STORE_PART_PATH_TEMPLATE:', CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE);
        
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
            console.log(`Overlap detected: ${overlapLen} characters`);
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
    
    console.log(`Merging ${sortedChunks.length} chunks for document`);
    
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
    
    console.log(`Merge complete: ${totalOverlapRemoved} characters of overlap removed`);
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
    
    console.log(`Selected ${selectedChunks.length} chunks around representative chunk (context: ${contextSize} chars)`);
    
    // Merge the selected chunks with overlap removal
    return mergeDocumentChunks(selectedChunks);
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
        console.log('Loading metadata from:', CONFIG.VECTOR_STORE_META_PATH);
        console.log('Current location:', window.location.href);
        console.log('Resolved URL:', new URL(CONFIG.VECTOR_STORE_META_PATH, window.location.href).href);
        const metaResponse = await fetch(CONFIG.VECTOR_STORE_META_PATH);
        if (!metaResponse.ok) {
            throw new Error(`Failed to load metadata: ${metaResponse.status}`);
        }
        
        const metadata = await metaResponse.json();
        console.log('Metadata loaded:', metadata);
        
        // Load all parts
        const parts = [];
        const totalSteps = metadata.num_parts;
        
        for (let partIndex = 1; partIndex <= metadata.num_parts; partIndex++) {
            const loadingMessage = CONFIG.IS_LOCAL_ACCESS ? 
                `Loading part ${partIndex}/${metadata.num_parts} by local...` :
                `Loading part ${partIndex}/${metadata.num_parts}...`;
            elements.loadingStatus.textContent = loadingMessage;
            
            const partPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE.replace('{}', String(partIndex).padStart(2, '0'));
            console.log(`Loading part ${partIndex} from:`, partPath);
            console.log(`Resolved part URL:`, new URL(partPath, window.location.href).href);
            
            const response = await fetch(partPath);
            if (!response.ok) {
                throw new Error(`Failed to load part ${partIndex}: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
            const partData = JSON.parse(decompressed);
            
            console.log(`Part ${partIndex} loaded:`, {
                partDocuments: partData.part_documents,
                documentsLength: partData.documents.length
            });
            
            parts.push(partData);
            
            // Update progress bar
            updateProgress(partIndex, totalSteps);
        }
        
        // Create vector store object with preliminary-final search functionality
        vectorStore = {
            parts: parts,
            metadata: metadata,
            totalDocuments: metadata.total_documents,
            embeddingDimension: metadata.embedding_dimension,
            
            search: async function(query, k = CONFIG.FINAL_RESULT_COUNT) {
                if (!embedder) {
                    throw new Error('Embedder not initialized');
                }
                
                console.log(`Starting preliminary-final search for: "${query}"`);
                console.log(`Parts: ${this.parts.length}, Total docs: ${this.totalDocuments}`);
                
                // Get query embedding
                console.log('Getting query embedding with HuggingFace Transformers.js...');
                const output = await embedder(query, { pooling: 'mean', normalize: true });
                const queryEmbedding = Array.from(output.data);
                
                console.log('Query embedding dimension:', queryEmbedding.length);
                
                // Phase 1: Preliminary search in each part
                const preliminaryResults = [];
                
                for (let partIndex = 0; partIndex < this.parts.length; partIndex++) {
                    const part = this.parts[partIndex];
                    const partSimilarities = [];
                    
                    // Search in this part
                    for (let docIndex = 0; docIndex < part.documents.length; docIndex++) {
                        const doc = part.documents[docIndex];
                        if (!doc.embedding || !Array.isArray(doc.embedding)) {
                            continue;
                        }
                        
                        const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
                        if (!isNaN(similarity)) {
                            partSimilarities.push({
                                id: doc.id,
                                content: doc.content,
                                metadata: doc.metadata,
                                score: similarity,
                                partIndex: partIndex
                            });
                        }
                    }
                    
                    // Get top preliminary results from this part
                    partSimilarities.sort((a, b) => b.score - a.score);
                    const topFromPart = partSimilarities.slice(0, CONFIG.PRELIMINARY_DOCS_PER_PART);
                    preliminaryResults.push(...topFromPart);
                    
                    console.log(`Part ${partIndex + 1}: ${topFromPart.length} preliminary results`);
                }
                
                console.log(`Preliminary phase complete: ${preliminaryResults.length} candidates`);
                
                // Phase 2: Final ranking of all preliminary results
                preliminaryResults.sort((a, b) => b.score - a.score);
                const finalResults = preliminaryResults.slice(0, k);
                
                console.log(`Final phase complete: ${finalResults.length} results`);
                
                // Apply document grouping if enabled
                let processedResults;
                if (GROUP_BY_DOCUMENT) {
                    console.log('Grouping results by document...');
                    
                    // Group chunks by document ID
                    const documentGroups = new Map();
                    
                    for (const doc of finalResults) {
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
                    
                    console.log(`Document grouping complete: ${documentArray.length} unique documents, showing top 10`);
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
                    
                    // Generate curid-based URL for reliable access
                    let url = '#';
                    const pageId = doc.metadata ? doc.metadata.id : doc.id;
                    
                    if (doc.metadata && doc.metadata.id && doc.metadata.id.match(/^\d+$/)) {
                        // If id is a numeric page ID, use curid format
                        url = `${CONFIG.SITE_BASE_URL}/?curid=${doc.metadata.id}`;
                        console.log(`Using curid format: ID=${doc.metadata.id}, URL=${url}`);
                    } else if (doc.metadata && doc.metadata.url) {
                        // Fallback to original URL if page_id is not available
                        url = doc.metadata.url;
                        console.log(`Using fallback URL: ID=${pageId}, URL=${url}`);
                    }
                    
                    return {
                        title: doc.metadata.title || 'Unknown',
                        content: docContent,
                        score: docScore,
                        url: url,
                        id: pageId,
                        isDocumentGroup: GROUP_BY_DOCUMENT,
                        chunkCount: GROUP_BY_DOCUMENT ? item.allChunks.length : 1,
                        allChunks: GROUP_BY_DOCUMENT ? item.allChunks : [doc]
                    };
                });
                
                console.log('Final results:', formattedResults.map(r => ({ title: r.title, score: r.score.toFixed(4) })));
                return formattedResults;
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
        errors.push('Please configure LLM API settings in the Configuration section below');
    }
    
    // Check vector store
    if (!vectorStore) {
        errors.push('Please load the data in the Configuration section below');
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
async function handleSend(elements) {
    const query = elements.promptWindow.value.trim();
    if (!query) return;
    
    // At this point, all validations should already pass since send button is only enabled when ready
    const apiKey = elements.apiKey.value.trim();
    
    // Disable inputs during processing
    elements.sendBtn.disabled = true;
    elements.promptWindow.disabled = true;
    
    // Clear previous results
    elements.responseWindow.innerHTML = '<div class="loading-spinner"></div> Searching and generating response...';
    elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Searching documents...';
    
    try {
        // Search vector store using HuggingFace embeddings
        console.log('Starting vector search for query:', query);
        console.log('Vector store available:', !!vectorStore);
        const searchResults = await vectorStore.search(query);
        console.log('Search completed. Results count:', searchResults.length);
        console.log('Sample scores:', searchResults.slice(0, 5).map(r => r.score));
        
        displayRAGResults(elements, searchResults);
        
        // Generate AI response using OpenAI LLM
        await generateAIResponse(elements, query, searchResults, apiKey);
        
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
function displayRAGResults(elements, results) {
    if (!results || results.length === 0) {
        elements.ragWindow.innerHTML = '<p class="no-results">No relevant documents found.</p>';
        return;
    }
    
    const resultsHTML = results.map((result, index) => {
        let scoreText = `Score: ${result.score.toFixed(4)} | ID: ${result.id}`;
        
        // Add chunk count information for document grouping
        if (result.isDocumentGroup && result.chunkCount > 1) {
            scoreText += ` | ${result.chunkCount} chunks`;
        }
        
        return `
        <div class="rag-result">
            <div class="result-header">
                <span class="result-number">${index + 1}.</span>
                <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                <span class="result-score">${scoreText}</span>
            </div>
            <div class="result-content">
                ${SHOW_FULL_RAG_CONTENT ? result.content : 
                  (result.content.substring(0, 300) + (result.content.length > 300 ? '...' : ''))}
            </div>
        </div>
        `;
    }).join('');
    
    elements.ragWindow.innerHTML = resultsHTML;
}

// Generate AI response using OpenAI API
async function generateAIResponse(elements, query, searchResults, apiKey) {
    try {
        const baseUrl = elements.baseUrl.value.trim();
        
        // Create context from search results
        const context = searchResults.map(result => {
            if (result.isDocumentGroup && result.allChunks && result.allChunks.length > 1) {
                // For document groups, check total size first
                const estimatedSize = result.allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
                console.log(`Processing document group: ${result.title} (${result.allChunks.length} chunks, ~${estimatedSize} chars)`);
                
                let mergedContent;
                if (estimatedSize > DOCUMENT_SIZE_LIMIT) {
                    // Document too large - use representative chunk context
                    console.log(`Document exceeds ${DOCUMENT_SIZE_LIMIT} chars - using representative chunk context`);
                    mergedContent = getRepresentativeChunksContext(result.allChunks, result, DOCUMENT_SIZE_LIMIT / 2);
                } else {
                    // Document within limit - merge all chunks
                    console.log(`Document within size limit - merging all chunks`);
                    mergedContent = mergeDocumentChunks(result.allChunks);
                }
                
                return `**${result.title}**\n${mergedContent}`;
            } else {
                // For single chunks, use original format
                return `**${result.title}**\n${result.content}`;
            }
        }).join('\n\n');
        
        const systemPrompt = `You are a helpful assistant that answers questions about googology using the provided context from the Googology Wiki. 
        
Use the following context to answer the user's question. If the context doesn't contain enough information to answer the question, say so clearly.

You can use LaTeX math notation in your responses - inline math with $...$ and display math with $$...$$ - as MathJax will render it properly.

Context from Googology Wiki:
${context}`;

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
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Display the response
        let responseHTML = `<div class="ai-response">${aiResponse.replace(/\n/g, '<br>')}</div>`;
        
        // Add debug info if enabled
        if (SHOW_DEBUG_INFO) {
            const debugInfo = `
                <div class="debug-info">
                    <strong>--- RAG DEBUG INFO ---</strong><br>
                    Query: "${query}"<br>
                    Total documents in vector store: ${vectorStore.totalDocuments}<br>
                    Search results found: ${searchResults.length}<br>
                    Top 3 results:<br>
                    ${searchResults.slice(0, 3).map((r, i) => 
                        `${i + 1}. ${r.title} (Score: ${r.score.toFixed(4)}, ID: ${r.id})<br>Preview: ${r.content.substring(0, 100)}...`
                    ).join('<br>')}
                </div>
            `;
            responseHTML += debugInfo;
        }
        
        // Set response content and trigger MathJax rendering
        elements.responseWindow.innerHTML = responseHTML;
        
        // Re-render MathJax for the new content
        if (window.MathJax) {
            window.MathJax.typesetPromise([elements.responseWindow]).catch((err) => {
                console.warn('MathJax rendering error:', err);
            });
        }
        
    } catch (error) {
        console.error('Error generating AI response:', error);
        elements.responseWindow.innerHTML = `<p class="error">Failed to generate response: ${error.message}</p>`;
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
    console.log('Initializing HuggingFace embedding pipeline for retrieval...');
    elements.loadingStatus.textContent = 'Initializing embedding model...';
    
    try {
        embedder = await pipeline('feature-extraction', CONFIG.EMBEDDING_MODEL);
        console.log('HuggingFace embedding pipeline initialized successfully');
        
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
    
    // Single delayed check for initial error display
    setTimeout(() => {
        checkAndShowErrors(elements);
    }, 1000);
}

// Export the initialization function
export { initializeRAG };