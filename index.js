// Import Transformers.js for HuggingFace embeddings
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js';

// Debug flag - set to true to show debug info in AI response
const SHOW_DEBUG_INFO = false;

// Global state
let vectorStore = null;
let isLoading = false;
let embedder = null;

// Configuration
const CONFIG = {
    CURRENT_SITE: 'googology-wiki',
    SITE_BASE_URL: 'https://googology.fandom.com',
    VECTOR_STORE_META_PATH: 'data/googology-wiki/vector_store_meta.json',
    VECTOR_STORE_PART_PATH_TEMPLATE: 'data/googology-wiki/vector_store_part{}.json.gz',
    DEFAULT_TOP_K: 5,
    DEFAULT_API_URL: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-3.5-turbo',
    EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',  // HuggingFace for retrieval
    // Split search configuration (will be loaded from site config)
    PRELIMINARY_DOCS_PER_PART: 10,
    FINAL_RESULT_COUNT: 10
};

// DOM Elements
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set default API URL
    elements.baseUrl.value = CONFIG.DEFAULT_API_URL;
    
    // Initialize the embedding pipeline for retrieval
    console.log('Initializing HuggingFace embedding pipeline for retrieval...');
    elements.loadingStatus.textContent = 'Initializing embedding model...';
    
    try {
        embedder = await pipeline('feature-extraction', CONFIG.EMBEDDING_MODEL);
        console.log('HuggingFace embedding pipeline initialized successfully');
        elements.loadingStatus.textContent = 'Embedding model ready - click "Load Data"';
    } catch (error) {
        console.error('Failed to initialize embedding pipeline:', error);
        elements.loadingStatus.textContent = 'Failed to initialize embedding model';
    }
    
    // Initial error check - removed early checks to avoid showing errors before password manager fills values
    
    // Event listeners
    elements.loadDataBtn.addEventListener('click', loadVectorStore);
    elements.sendBtn.addEventListener('click', handleSend);
    elements.promptWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !elements.sendBtn.disabled) {
            handleSend();
        }
    });
    
    // Listen for input changes to update error messages
    elements.baseUrl.addEventListener('input', checkAndShowErrors);
    elements.apiKey.addEventListener('input', checkAndShowErrors);
    
    // Single delayed check for initial error display
    setTimeout(() => {
        checkAndShowErrors();
    }, 1000);
    
});

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
async function loadVectorStore() {
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
            elements.loadingStatus.textContent = `Loading part ${partIndex}/${metadata.num_parts}...`;
            
            const partPath = CONFIG.VECTOR_STORE_PART_PATH_TEMPLATE.replace('{}', String(partIndex).padStart(2, '0'));
            console.log(`Loading part ${partIndex} from:`, partPath);
            
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
                
                // Format results
                const formattedResults = finalResults.map(doc => {
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
                        content: doc.content,
                        score: doc.score,
                        url: url,
                        id: pageId
                    };
                });
                
                console.log('Final results:', formattedResults.map(r => ({ title: r.title, score: r.score.toFixed(4) })));
                return formattedResults;
            }
        };
        
        elements.loadingStatus.textContent = 'Data loaded successfully';
        
        // Update error messages after vector store is loaded
        checkAndShowErrors();
        
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
function showErrorMessages(messages) {
    elements.errorMessages.innerHTML = messages
        .map(msg => `<div class="error-message">${msg}</div>`)
        .join('');
}

function clearErrorMessages() {
    elements.errorMessages.innerHTML = '';
}

// Check and display error messages continuously
function checkAndShowErrors() {
    const errors = [];
    
    // Check API settings
    const baseUrl = elements.baseUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();
    
    // Debug: Log API values during check
    console.log('checkAndShowErrors - API values:', {
        baseUrl: baseUrl || '(empty)',
        apiKey: apiKey ? `[${apiKey.length} chars]` : '(empty)',
        vectorStore: !!vectorStore
    });
    
    if (!baseUrl || !apiKey) {
        errors.push('Please configure LLM API settings in the Configuration section below');
    }
    
    // Check vector store
    if (!vectorStore) {
        errors.push('Please load the data in the Configuration section below');
    }
    
    // Show or clear error messages
    if (errors.length > 0) {
        showErrorMessages(errors);
        elements.sendBtn.disabled = true;
    } else {
        clearErrorMessages();
        elements.sendBtn.disabled = false;
    }
}


// Handle send button click
async function handleSend() {
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
        
        displayRAGResults(searchResults);
        
        // Generate AI response using OpenAI LLM
        await generateAIResponse(query, searchResults, apiKey);
        
    } catch (error) {
        console.error('Error during search:', error);
        elements.responseWindow.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        elements.ragWindow.innerHTML = `<p class="error">Search failed: ${error.message}</p>`;
    } finally {
        elements.promptWindow.disabled = false;
        // Re-check errors to restore correct send button state
        checkAndShowErrors();
    }
}

// Display RAG search results
function displayRAGResults(results) {
    if (!results || results.length === 0) {
        elements.ragWindow.innerHTML = '<p class="no-results">No relevant documents found.</p>';
        return;
    }
    
    const resultsHTML = results.map((result, index) => `
        <div class="rag-result">
            <div class="result-header">
                <span class="result-number">${index + 1}.</span>
                <a href="${result.url}" target="_blank" class="result-title">${result.title}</a>
                <span class="result-score">Score: ${result.score.toFixed(4)} | ID: ${result.id}</span>
            </div>
            <div class="result-content">
                ${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}
            </div>
        </div>
    `).join('');
    
    elements.ragWindow.innerHTML = resultsHTML;
}

// Generate AI response using OpenAI API
async function generateAIResponse(query, searchResults, apiKey) {
    try {
        const baseUrl = elements.baseUrl.value.trim();
        
        // Create context from search results
        const context = searchResults.map(result => 
            `**${result.title}**\n${result.content}`
        ).join('\n\n');
        
        const systemPrompt = `You are a helpful assistant that answers questions about googology using the provided context from the Googology Wiki. 
        
Use the following context to answer the user's question. If the context doesn't contain enough information to answer the question, say so clearly.

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
        
        elements.responseWindow.innerHTML = responseHTML;
        
    } catch (error) {
        console.error('Error generating AI response:', error);
        elements.responseWindow.innerHTML = `<p class="error">Failed to generate response: ${error.message}</p>`;
    }
}