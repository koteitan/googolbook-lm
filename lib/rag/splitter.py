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
    
    # Split documents and track character positions
    all_chunks = []
    
    for doc in documents:
        # Split the document text
        text_chunks = text_splitter.split_text(doc.page_content)
        
        # Track character position in original document
        current_pos = 0
        
        for chunk_index, chunk_text in enumerate(text_chunks):
            # Find the actual position of this chunk in the original text
            chunk_start = doc.page_content.find(chunk_text, current_pos)
            if chunk_start == -1:
                # Fallback if exact match not found (shouldn't happen)
                chunk_start = current_pos
            
            chunk_end = chunk_start + len(chunk_text)
            
            # Create chunk document with position metadata
            chunk_metadata = doc.metadata.copy()
            chunk_metadata['chunk_index'] = chunk_index
            chunk_metadata['chunk_start'] = chunk_start
            chunk_metadata['chunk_end'] = chunk_end
            
            chunk_doc = Document(
                page_content=chunk_text,
                metadata=chunk_metadata
            )
            all_chunks.append(chunk_doc)
            
            # Update position for next search
            current_pos = chunk_start + 1
    
    return all_chunks