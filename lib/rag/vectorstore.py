"""Vector store creation and search utilities."""

from typing import List, Tuple, Optional
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings


def create_vector_store(
    documents: List[Document],
    embedding_model: str = "all-MiniLM-L6-v2",
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
    if use_openai:
        embeddings = OpenAIEmbeddings()
    else:
        embeddings = HuggingFaceEmbeddings(model_name=embedding_model)
    
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