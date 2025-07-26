"""Vector store creation and search utilities."""

from typing import List, Tuple, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    # Fallback to old import for compatibility
    from langchain_community.embeddings import HuggingFaceEmbeddings

from .embeddings import JapaneseMorphologicalEmbeddings, TinySegmenterEmbeddings


def create_vector_store(
    documents: List[Document],
    embedding_model: str = "all-MiniLM-L6-v2",
    use_openai: bool = False,
    tokenize_config: Optional[Dict[str, Any]] = None
) -> FAISS:
    """
    Create a FAISS vector store from documents.
    
    Args:
        documents: List of Document objects to index
        embedding_model: Model name for embeddings (for HuggingFace)
        use_openai: Whether to use OpenAI embeddings (requires API key)
        tokenize_config: Tokenization configuration (from config.yml)
        
    Returns:
        FAISS vector store instance
    """
    # Initialize base embeddings
    if use_openai:
        base_embeddings = OpenAIEmbeddings()
    else:
        base_embeddings = HuggingFaceEmbeddings(model_name=embedding_model)
    
    # Apply tokenization wrapper if configured
    tokenize_config = tokenize_config or {}
    tokenize_mode = tokenize_config.get('mode', 'normal')
    
    if tokenize_mode == 'mecab':
        print("Using Japanese morphological analysis with MeCab")
        embeddings = JapaneseMorphologicalEmbeddings(base_embeddings)
    elif tokenize_mode == 'tinysegmenter':
        print("Using Japanese morphological analysis with TinySegmenter")
        embeddings = TinySegmenterEmbeddings(base_embeddings)
    else:
        print("Using standard tokenization")
        embeddings = base_embeddings
    
    vector_store = FAISS.from_documents(documents, embeddings)
    return vector_store


def search_documents(
    vector_store: FAISS,
    query: str,
    k: int = 5,
    score_threshold: Optional[float] = None
) -> List[Tuple[Document, float]]:
    """
    Search for documents similar to the query.
    
    Args:
        vector_store: FAISS vector store to search
        query: Search query string
        k: Number of results to return
        score_threshold: Minimum similarity score (optional)
        
    Returns:
        List of tuples containing (Document, similarity_score)
    """
    results = vector_store.similarity_search_with_score(query, k=k)
    
    if score_threshold is not None:
        results = [(doc, score) for doc, score in results if score >= score_threshold]
    
    return results