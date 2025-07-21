// Global state
let vectorStore = null;
let isLoading = false;

// Configuration
const CONFIG = {
    CURRENT_SITE: 'googology-wiki',
    VECTOR_STORE_PATH: 'data/googology-wiki/vector_store.json.gz',
    DEFAULT_TOP_K: 5,
    DEFAULT_API_URL: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-3.5-turbo',
    EMBEDDING_MODEL: 'text-embedding-ada-002'
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
document.addEventListener('DOMContentLoaded', () => {
    // Set default API URL
    elements.baseUrl.value = CONFIG.DEFAULT_API_URL;
    
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
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
}

// Load vector store from compressed JSON
async function loadVectorStore() {
    if (isLoading) return;
    
    isLoading = true;
    elements.loadDataBtn.disabled = true;
    elements.loadingProgress.classList.add('loading');
    elements.loadingStatus.textContent = 'Loading vector store...';
    
    try {
        // Fetch the compressed JSON file
        const response = await fetch(CONFIG.VECTOR_STORE_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch vector store: ${response.status}`);
        }
        
        // Decompress and parse JSON
        const blob = await response.blob();
        const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressedResponse = new Response(decompressedStream);
        const jsonData = await decompressedResponse.json();
        
        console.log(`Loaded ${jsonData.total_documents} documents`);
        
        // Create vector store with search functionality
        vectorStore = {
            loaded: true,
            data: jsonData,
            documents: jsonData.documents,
            search: async (query, k = CONFIG.DEFAULT_TOP_K) => {
                const apiKey = elements.apiKey.value.trim();
                if (!apiKey) {
                    throw new Error('API key required for semantic search');
                }
                
                // Get query embedding from OpenAI
                const queryEmbedding = await getEmbedding(query, apiKey);
                
                // Calculate similarities
                const similarities = [];
                for (const doc of vectorStore.documents) {
                    const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
                    similarities.push({
                        ...doc,
                        score: similarity
                    });
                }
                
                // Sort by similarity and return top k
                similarities.sort((a, b) => b.score - a.score);
                return similarities.slice(0, k).map(doc => ({
                    title: doc.metadata.title || 'Unknown',
                    content: doc.content,
                    score: doc.score,
                    url: doc.metadata.url || '#',
                    id: doc.metadata.id || doc.id
                }));
            }
        };
        
        elements.sendBtn.disabled = false;
        elements.loadingStatus.textContent = 'Vector store loaded successfully';
        
    } catch (error) {
        console.error('Error loading vector store:', error);
        elements.loadingStatus.textContent = 'Failed to load vector store';
        elements.loadingProgress.classList.remove('loading');
    } finally {
        isLoading = false;
        elements.loadDataBtn.disabled = false;
    }
}

// Get embedding from OpenAI API
async function getEmbedding(text, apiKey) {
    const baseUrl = elements.baseUrl.value.trim();
    
    const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: CONFIG.EMBEDDING_MODEL,
            input: text
        })
    });
    
    if (!response.ok) {
        throw new Error(`Embedding API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
}


// Handle send button click
async function handleSend() {
    const query = elements.promptWindow.value.trim();
    if (!query) return;
    
    const apiKey = elements.apiKey.value.trim();
    if (!apiKey) {
        alert('Please enter your API key');
        return;
    }
    
    // Disable inputs during processing
    elements.sendBtn.disabled = true;
    elements.promptWindow.disabled = true;
    
    // Clear previous results
    elements.responseWindow.innerHTML = '<div class="loading-spinner"></div> Searching and generating response...';
    elements.ragWindow.innerHTML = '<div class="loading-spinner"></div> Searching documents...';
    
    try {
        // Search vector store
        const searchResults = await vectorStore.search(query);
        displayRAGResults(searchResults);
        
        // Generate response with LLM
        const response = await generateResponse(query, searchResults, apiKey);
        displayResponse(response);
        
    } catch (error) {
        console.error('Error processing query:', error);
        elements.responseWindow.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    } finally {
        elements.sendBtn.disabled = false;
        elements.promptWindow.disabled = false;
    }
}

// Display RAG search results
function displayRAGResults(results) {
    if (!results || results.length === 0) {
        elements.ragWindow.innerHTML = '<p class="placeholder">No relevant documents found.</p>';
        return;
    }
    
    const html = results.map((result, index) => `
        <div class="rag-result">
            <h4>${index + 1}. ${result.title}</h4>
            <div class="score">Score: ${result.score.toFixed(3)}</div>
            <div class="content">${result.content.substring(0, 200)}...</div>
            <a href="${result.url}" target="_blank" class="link">View on Wiki →</a>
        </div>
    `).join('');
    
    elements.ragWindow.innerHTML = html;
}

// Generate response using LLM API
async function generateResponse(query, searchResults, apiKey) {
    const baseUrl = elements.baseUrl.value.trim();
    
    // Prepare context from search results
    const context = searchResults.map(result => 
        `Title: ${result.title}\nContent: ${result.content}`
    ).join('\n\n');
    
    // Prepare prompt
    const systemPrompt = `You are a helpful assistant specialized in googology (the study of large numbers). 
    Answer questions based on the provided context from the Googology Wiki. 
    If the context doesn't contain enough information, say so clearly.`;
    
    const userPrompt = `Context from Googology Wiki:\n\n${context}\n\n
    Question: ${query}\n\n
    Please provide a comprehensive answer based on the context above.`;
    
    // Call OpenAI API (or compatible endpoint)
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
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// Display LLM response
function displayResponse(response) {
    // Convert markdown to HTML (basic conversion)
    const html = response
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    elements.responseWindow.innerHTML = `<p>${html}</p>`;
}

// Error styling
const style = document.createElement('style');
style.textContent = `
    .error {
        color: #e74c3c;
        padding: 15px;
        background-color: #ffe6e6;
        border-radius: 5px;
        margin: 10px 0;
    }
`;
document.head.appendChild(style);