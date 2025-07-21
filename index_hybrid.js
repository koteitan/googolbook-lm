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
    VECTOR_STORE_PATH: 'data/googology-wiki/vector_store.json.gz',
    DEFAULT_TOP_K: 5,
    DEFAULT_API_URL: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-3.5-turbo',
    EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',  // HuggingFace for retrieval
    EXPECTED_DOCUMENTS: 20000  // Expected number of documents (from VECTOR_STORE_SAMPLE_SIZE in site config)
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
    ragWindow: document.getElementById('rag-window')
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
        elements.loadingStatus.textContent = 'Embedding model ready - click "Load Vector Store"';
    } catch (error) {
        console.error('Failed to initialize embedding pipeline:', error);
        elements.loadingStatus.textContent = 'Failed to initialize embedding model';
    }
    
    // Event listeners
    elements.loadDataBtn.addEventListener('click', loadVectorStore);
    elements.sendBtn.addEventListener('click', handleSend);
    elements.promptWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !elements.sendBtn.disabled) {
            handleSend();
        }
    });
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

// Load vector store from compressed JSON
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
    elements.loadingStatus.textContent = 'Loading vector store...';
    
    try {
        console.log('Loading vector store from:', CONFIG.VECTOR_STORE_PATH);
        
        // Load compressed JSON
        const response = await fetch(CONFIG.VECTOR_STORE_PATH);
        if (!response.ok) {
            throw new Error(`Failed to load vector store: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Decompress gzip
        const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
        const data = JSON.parse(decompressed);
        
        console.log('Vector store data loaded:', {
            totalDocuments: data.total_documents,
            embeddingDimension: data.embedding_dimension,
            documentsArrayLength: data.documents.length
        });
        
        // Create vector store object with search functionality
        vectorStore = {
            documents: data.documents,
            totalDocuments: data.total_documents,
            embeddingDimension: data.embedding_dimension,
            
            search: async function(query, k = CONFIG.DEFAULT_TOP_K) {
                if (!embedder) {
                    throw new Error('Embedder not initialized');
                }
                
                console.log(`Searching for: "${query}" in ${this.documents.length} documents`);
                
                // Get query embedding using HuggingFace Transformers.js (same as vector store)
                console.log('Getting query embedding with HuggingFace Transformers.js...');
                const output = await embedder(query, { pooling: 'mean', normalize: true });
                const queryEmbedding = Array.from(output.data);
                
                console.log('Query embedding dimension:', queryEmbedding.length);
                console.log('Query embedding sample:', queryEmbedding.slice(0, 5));
                console.log('Query embedding contains NaN:', queryEmbedding.some(v => isNaN(v)));
                console.log('Query embedding contains non-numbers:', queryEmbedding.some(v => typeof v !== 'number'));
                
                // Calculate similarities
                const similarities = [];
                let validSimilarities = 0;
                let invalidSimilarities = 0;
                
                for (let i = 0; i < this.documents.length; i++) {
                    const doc = this.documents[i];
                    if (!doc.embedding || !Array.isArray(doc.embedding)) {
                        console.error(`Invalid embedding for document ${i}:`, doc);
                        invalidSimilarities++;
                        continue;
                    }
                    
                    const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
                    if (isNaN(similarity)) {
                        console.error(`NaN similarity for document ${i}:`, {
                            docId: doc.id,
                            queryEmbedding: queryEmbedding.slice(0, 5),
                            docEmbedding: doc.embedding.slice(0, 5),
                            similarity
                        });
                        invalidSimilarities++;
                    } else {
                        validSimilarities++;
                        similarities.push({
                            id: doc.id,
                            content: doc.content,
                            metadata: doc.metadata,
                            score: similarity
                        });
                    }
                    
                    // Log progress for large datasets
                    if (i > 0 && i % 5000 === 0) {
                        console.log(`Processed ${i}/${this.documents.length} documents`);
                    }
                }
                
                console.log(`Similarity calculation complete: ${validSimilarities} valid, ${invalidSimilarities} invalid`);
                
                if (validSimilarities === 0) {
                    console.error('No valid similarities calculated!');
                    return [];
                }
                
                // Sort by similarity and return top k
                similarities.sort((a, b) => b.score - a.score);
                
                // Log statistics
                const scores = similarities.map(s => s.score);
                console.log('Score statistics:', {
                    max: Math.max(...scores),
                    min: Math.min(...scores),
                    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
                    nonZero: scores.filter(s => s > 0).length
                });
                
                const topResults = similarities.slice(0, k).map(doc => ({
                    title: doc.metadata.title || 'Unknown',
                    content: doc.content,
                    score: doc.score,
                    url: doc.metadata.url || '#',
                    id: doc.metadata.id || doc.id
                }));
                
                console.log('Top results:', topResults.map(r => ({ title: r.title, score: r.score })));
                return topResults;
            }
        };
        
        elements.sendBtn.disabled = false;
        elements.loadingStatus.textContent = 'Vector store loaded successfully';
        
    } catch (error) {
        console.error('Error loading vector store:', error);
        elements.loadingStatus.textContent = 'Failed to load vector store: ' + error.message;
        elements.loadingProgress.classList.remove('loading');
    } finally {
        isLoading = false;
        elements.loadDataBtn.disabled = false;
    }
}

// Handle send button click
async function handleSend() {
    const query = elements.promptWindow.value.trim();
    if (!query) return;
    
    const apiKey = elements.apiKey.value.trim();
    if (!apiKey) {
        alert('Please enter your OpenAI API key for LLM generation');
        return;
    }
    
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
        elements.sendBtn.disabled = false;
        elements.promptWindow.disabled = false;
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
                <span class="result-score">Score: ${result.score.toFixed(4)}</span>
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