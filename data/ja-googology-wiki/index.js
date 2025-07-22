// Site-specific entry point for Japanese Googology Wiki
import { initializeRAG } from '../../lib/rag-common.js';

// Site configuration
const currentSite = 'ja-googology-wiki';

// Initialize the RAG system for this site
document.addEventListener('DOMContentLoaded', () => {
    initializeRAG(currentSite);
});