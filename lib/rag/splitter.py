"""Document splitting utilities for RAG processing."""

from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def split_documents(
    documents: List[Document],
    chunk_size: int = 1200,
    chunk_overlap: int = 300
) -> List[Document]:
    """
    Split documents into smaller chunks for vector processing.
    
    Optimized for Googology Wiki content:
    - Larger chunks (1200 chars) to preserve mathematical definitions
    - Higher overlap (300 chars/25%) to maintain concept continuity
    - Wiki-aware separators for better semantic boundaries
    
    Args:
        documents: List of Document objects to split
        chunk_size: Maximum size of each chunk in characters (default: 1200)
        chunk_overlap: Number of overlapping characters between chunks (default: 300)
        
    Returns:
        List of Document objects representing chunks
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
        separators=[
            "\n\n# ",          # Major headings
            "\n\n## ",         # Section headings  
            "\n\n### ",        # Subsection headings
            "\n\n#### ",       # Minor headings
            "\n\n",            # Paragraph breaks
            "\n* ",            # List items
            "\n- ",            # List items (alt)
            "\n",              # Line breaks
            ". ",              # Sentences
            ", ",              # Clauses
            " "                # Words
        ]
    )
    
    chunks = text_splitter.split_documents(documents)
    return chunks