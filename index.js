// Global state
let vectorStore = null;
let isLoading = false;

// Configuration
const CONFIG = {
    CURRENT_SITE: 'googology-wiki',
    VECTOR_STORE_PATH: 'data/googology-wiki/vector_store.pkl.gz',
    DEFAULT_TOP_K: 5,
    DEFAULT_API_URL: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-3.5-turbo'
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

// Load vector store from zipped pickle file
async function loadVectorStore() {
    if (isLoading) return;
    
    isLoading = true;
    elements.loadDataBtn.disabled = true;
    elements.loadingProgress.classList.add('loading');
    elements.loadingStatus.textContent = 'Loading vector store...';
    
    try {
        // Note: In a real implementation, we would need:
        // 1. A JavaScript library to read gzipped pickle files
        // 2. A JavaScript implementation of FAISS or similar vector search
        // 3. Or a backend service to handle vector operations
        
        // For now, we'll simulate loading
        await simulateLoading();
        
        // In production, this would load the actual vector store
        vectorStore = {
            loaded: true,
            search: async (query, k = CONFIG.DEFAULT_TOP_K) => {
                // Simulated search results
                return [
                    {
                        title: "Googology",
                        content: "Googology is the study and nomenclature of large numbers...",
                        score: 0.95,
                        url: "https://googology.fandom.com/wiki/?curid=1897",
                        id: "1897"
                    },
                    {
                        title: "Graham's number",
                        content: "Graham's number is an immense number that arose as an upper bound...",
                        score: 0.89,
                        url: "https://googology.fandom.com/wiki/?curid=2345",
                        id: "2345"
                    }
                ];
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

// Simulate loading for demonstration
async function simulateLoading() {
    return new Promise(resolve => {
        setTimeout(resolve, 2000);
    });
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