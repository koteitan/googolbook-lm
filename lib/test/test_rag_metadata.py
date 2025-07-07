#!/usr/bin/env python3
"""Test RAG metadata preservation through the pipeline"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.rag import split_documents
from lib.io_utils import find_xml_file
import config

def test_metadata_pipeline():
    """Test metadata preservation through loader -> splitter pipeline"""
    
    xml_path = find_xml_file()
    print(f"1. Loading from: {xml_path}")
    
    # Step 1: Load documents
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=[0],  # Main namespace only
        skip_redirects=False,  # Include redirects to see if they have metadata
        stop_on_error=False
    )
    
    # Load and limit to first 10 for testing
    all_docs = loader.load()
    documents = all_docs[:10]
    
    print(f"\n2. Loaded {len(documents)} test documents (out of {len(all_docs)} total)")
    
    # Check original metadata
    print("\n3. Original document metadata:")
    for i, doc in enumerate(documents[:3]):
        print(f"\n   Document {i+1}:")
        print(f"   - Content: {repr(doc.page_content[:50])}...")
        print(f"   - Metadata: {doc.metadata}")
    
    # Step 2: Split documents
    print("\n4. Splitting documents...")
    chunks = split_documents(documents, chunk_size=500, chunk_overlap=50)
    print(f"   Created {len(chunks)} chunks from {len(documents)} documents")
    
    # Check chunk metadata
    print("\n5. Chunk metadata (first 3 chunks):")
    for i, chunk in enumerate(chunks[:3]):
        print(f"\n   Chunk {i+1}:")
        print(f"   - Content: {repr(chunk.page_content[:50])}...")
        print(f"   - Metadata: {chunk.metadata}")
    
    # Find chunks with actual metadata
    chunks_with_metadata = [c for c in chunks if c.metadata and any(v for v in c.metadata.values() if v != 'N/A')]
    print(f"\n6. Chunks with metadata: {len(chunks_with_metadata)} out of {len(chunks)}")
    
    if chunks_with_metadata:
        print("\n   Example chunk with metadata:")
        chunk = chunks_with_metadata[0]
        print(f"   - Content: {repr(chunk.page_content[:50])}...")
        print(f"   - Metadata: {chunk.metadata}")

if __name__ == "__main__":
    test_metadata_pipeline()