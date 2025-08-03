// Site-specific entry point for English Googology Wiki
import { initializeRAG } from '../../lib/js/rag-common.js';

// Site configuration
const currentSite = 'googology-wiki';

// Initialize the RAG system for this site
document.addEventListener('DOMContentLoaded', () => {
    initializeRAG(currentSite);
});