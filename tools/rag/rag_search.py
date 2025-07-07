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


def load_vector_store(cache_path: str) -> object:
    """Load vector store from cache file."""
    if not os.path.exists(cache_path):
        raise FileNotFoundError(f"Vector store not found: {cache_path}")
    
    print(f"Loading vector store from: {cache_path}")
    with open(cache_path, 'rb') as f:
        return pickle.load(f)


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
        '--cache',
        default='cache/vector_store.pkl',
        help='Path to vector store file (default: cache/vector_store.pkl)'
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
    
    try:
        # Load vector store
        vector_store = load_vector_store(args.cache)
        
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
            
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print(f"Please create the vector store first using:")
        print(f"  python tools/rag/xml2vec.py --output {args.cache}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()