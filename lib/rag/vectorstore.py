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

# Note: Direct multilingual model usage (no morphological analysis wrapper needed)


def create_vector_store(
    documents: List[Document],
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    use_openai: bool = False
) -> FAISS:
    """
    Create a FAISS vector store from documents.
    
    Args:
        documents: List of Document objects to index
        embedding_model: Model name for embeddings (for HuggingFace)
        use_openai: Whether to use OpenAI embeddings (requires API key)
        
    Returns:
        FAISS vector store instance
    """
    # Initialize base embeddings
    if use_openai:
        base_embeddings = OpenAIEmbeddings()
    else:
        # Normalize embeddings to match JavaScript behavior
        base_embeddings = HuggingFaceEmbeddings(
            model_name=embedding_model,
            encode_kwargs={'normalize_embeddings': True}
        )
    
    # Use the base embeddings directly (multilingual model handles Japanese internally)
    print(f"Using multilingual embedding model: {embedding_model}")
    embeddings = base_embeddings
    
    print(f"Creating embeddings for {len(documents):,} documents...")
    # Create vector store with progress tracking
    vector_store = None
    batch_size = 100
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        if i == 0:
            vector_store = FAISS.from_documents(batch, embeddings)
        else:
            batch_store = FAISS.from_documents(batch, embeddings)
            vector_store.merge_from(batch_store)
        
        print(f"Embedded {min(i + batch_size, len(documents)):,}/{len(documents):,} documents...", end='\r')
    
    print(f"\nFinished creating embeddings for {len(documents):,} documents")
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