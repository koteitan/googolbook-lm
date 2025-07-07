#!/usr/bin/env python3
"""
Vector Store Creation Tool for MediaWiki RAG System

This tool creates and saves a vector store from MediaWiki XML data.
Run this once to prepare the data for fast searches.
"""

import os
import sys
import argparse
import pickle
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import (
    load_mediawiki_documents,
    split_documents,
    create_vector_store
)
from lib.io_utils import find_xml_file
from lib.formatting import format_number
import config


def create_and_save_vector_store(
    xml_path: str,
    output_path: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    use_openai: bool = False,
    embedding_model: str = "all-MiniLM-L6-v2"
):
    """Create vector store from XML and save to disk."""
    
    print(f"Loading documents from: {xml_path}")
    documents = load_mediawiki_documents(xml_path, namespace_filter=[0])
    print(f"✓ Loaded {format_number(len(documents))} documents")
    
    print(f"Splitting documents (chunk_size={chunk_size}, overlap={chunk_overlap})")
    chunks = split_documents(documents, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    print(f"✓ Created {format_number(len(chunks))} chunks")
    
    print(f"Creating vector store...")
    if use_openai:
        print("  Using OpenAI embeddings")
    else:
        print(f"  Using HuggingFace embeddings: {embedding_model}")
    
    vector_store = create_vector_store(
        chunks, 
        embedding_model=embedding_model,
        use_openai=use_openai
    )
    
    print(f"Saving vector store to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        pickle.dump(vector_store, f)
    
    print(f"✓ Vector store saved successfully!")
    print(f"  File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
    
    return vector_store


def main():
    parser = argparse.ArgumentParser(
        description=f'Create vector store for {config.SITE_NAME} RAG system'
    )
    parser.add_argument(
        '--xml-file',
        help='Path to XML file (auto-detected if not specified)'
    )
    parser.add_argument(
        '--output',
        default=str(config.DATA_DIR / 'vector_store.pkl'),
        help=f'Output path for vector store (default: {config.DATA_DIR}/vector_store.pkl)'
    )
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=1200,
        help='Chunk size for text splitting (default: 1200, optimized for Googology Wiki)'
    )
    parser.add_argument(
        '--chunk-overlap',
        type=int,
        default=300,
        help='Chunk overlap for text splitting (default: 300, 25%% overlap for concept continuity)'
    )
    parser.add_argument(
        '--use-openai',
        action='store_true',
        help='Use OpenAI embeddings instead of HuggingFace (requires OPENAI_API_KEY)'
    )
    parser.add_argument(
        '--embedding-model',
        default='all-MiniLM-L6-v2',
        help='HuggingFace embedding model (default: all-MiniLM-L6-v2)'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing vector store'
    )
    
    args = parser.parse_args()
    
    # Check if output file exists
    if os.path.exists(args.output) and not args.force:
        print(f"Error: Output file already exists: {args.output}")
        print("Use --force to overwrite")
        sys.exit(1)
    
    # Find XML file
    if args.xml_file:
        xml_path = args.xml_file
    else:
        xml_path = find_xml_file()
        if not xml_path:
            print("Error: No XML file found. Please specify --xml-file")
            sys.exit(1)
    
    if not os.path.exists(xml_path):
        print(f"Error: XML file not found: {xml_path}")
        sys.exit(1)
    
    try:
        create_and_save_vector_store(
            xml_path,
            args.output,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
            use_openai=args.use_openai,
            embedding_model=args.embedding_model
        )
        
        print(f"\nVector store created successfully!")
        print(f"Now you can search using:")
        print(f"  python tools/rag/rag_search.py 'What is Graham\\'s Number?' --cache {args.output}")
        
    except Exception as e:
        print(f"Error creating vector store: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()