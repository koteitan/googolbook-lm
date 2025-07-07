#!/usr/bin/env python3
"""
RAG Search Tool for Googology Wiki

This tool implements a Retrieval-Augmented Generation (RAG) system
to search through Googology Wiki content using vector similarity.
"""

import os
import sys
import argparse
import pickle
from typing import Optional
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import (
    load_mediawiki_documents,
    split_documents,
    create_vector_store,
    search_documents
)
from lib.io_utils import find_xml_file
from lib.formatting import format_number
import config


def load_or_create_vector_store(
    xml_path: str,
    cache_path: Optional[str] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    force_rebuild: bool = False
) -> object:
    """Load vector store from cache or create new one."""
    
    if cache_path and os.path.exists(cache_path) and not force_rebuild:
        print(f"Loading vector store from cache: {cache_path}")
        with open(cache_path, 'rb') as f:
            return pickle.load(f)
    
    print(f"Loading documents from: {xml_path}")
    documents = load_mediawiki_documents(xml_path, namespace_filter=[0])
    print(f"Loaded {format_number(len(documents))} documents")
    
    print(f"Splitting documents (chunk_size={chunk_size}, overlap={chunk_overlap})")
    chunks = split_documents(documents, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    print(f"Created {format_number(len(chunks))} chunks")
    
    print("Creating vector store...")
    vector_store = create_vector_store(chunks, use_openai=False)
    
    if cache_path:
        print(f"Saving vector store to cache: {cache_path}")
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'wb') as f:
            pickle.dump(vector_store, f)
    
    return vector_store


def format_search_results(results):
    """Format search results for display."""
    output = []
    
    for i, (doc, score) in enumerate(results, 1):
        output.append(f"\n{'='*60}")
        output.append(f"Result {i} (Score: {score:.4f})")
        output.append(f"{'='*60}")
        
        # Display metadata
        metadata = doc.metadata
        output.append(f"Title: {metadata.get('title', 'Unknown')}")
        output.append(f"URL: {metadata.get('url', 'N/A')}")
        output.append(f"ID: {metadata.get('id', 'N/A')}")
        
        # Display content preview
        content = doc.page_content
        preview_length = 500
        if len(content) > preview_length:
            content = content[:preview_length] + "..."
        
        output.append(f"\nContent Preview:")
        output.append(content)
    
    return '\n'.join(output)


def main():
    parser = argparse.ArgumentParser(
        description='Search Googology Wiki using RAG (Retrieval-Augmented Generation)'
    )
    parser.add_argument(
        'query',
        nargs='?',
        default="What is Graham's Number?",
        help='Search query (default: "What is Graham\'s Number?")'
    )
    parser.add_argument(
        '--xml-file',
        help='Path to XML file (auto-detected if not specified)'
    )
    parser.add_argument(
        '--cache',
        default='cache/vector_store.pkl',
        help='Path to cache file for vector store (default: cache/vector_store.pkl)'
    )
    parser.add_argument(
        '--no-cache',
        action='store_true',
        help='Disable caching'
    )
    parser.add_argument(
        '--rebuild',
        action='store_true',
        help='Force rebuild of vector store even if cache exists'
    )
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=1000,
        help='Chunk size for text splitting (default: 1000)'
    )
    parser.add_argument(
        '--chunk-overlap',
        type=int,
        default=200,
        help='Chunk overlap for text splitting (default: 200)'
    )
    parser.add_argument(
        '--top-k',
        type=int,
        default=5,
        help='Number of results to return (default: 5)'
    )
    parser.add_argument(
        '--score-threshold',
        type=float,
        help='Minimum similarity score threshold'
    )
    
    args = parser.parse_args()
    
    # Find XML file
    if args.xml_file:
        xml_path = args.xml_file
    else:
        xml_path = find_xml_file()
        if not xml_path:
            print("Error: No XML file found. Please specify --xml-file")
            sys.exit(1)
    
    # Determine cache path
    cache_path = None if args.no_cache else args.cache
    
    try:
        # Load or create vector store
        vector_store = load_or_create_vector_store(
            xml_path,
            cache_path=cache_path,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
            force_rebuild=args.rebuild
        )
        
        # Perform search
        print(f"\nSearching for: {args.query}")
        results = search_documents(
            vector_store,
            args.query,
            k=args.top_k,
            score_threshold=args.score_threshold
        )
        
        if not results:
            print("No results found.")
        else:
            print(f"\nFound {len(results)} results:")
            print(format_search_results(results))
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()