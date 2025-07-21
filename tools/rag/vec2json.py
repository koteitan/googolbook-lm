#!/usr/bin/env python3
"""
Export Vector Store to JSON

This tool exports the FAISS vector store to JSON format for JavaScript consumption.
"""

import os
import sys
import json
import pickle
import gzip
import argparse
import numpy as np
import importlib.util
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import config
from lib.io_utils import find_xml_file
from lib.formatting import format_number

# Import site-specific configuration
site_config_path = config.DATA_DIR / 'config.py'
if site_config_path.exists():
    spec = importlib.util.spec_from_file_location("site_config", site_config_path)
    site_config = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(site_config)
else:
    site_config = None


def export_vector_store_to_json(vector_store_path: str, output_path: str, max_docs: int = None):
    """
    Export vector store to JSON format.
    
    Args:
        vector_store_path: Path to the vector store pickle file
        output_path: Path for the output JSON file
        max_docs: Maximum number of documents to export (None for all)
    """
    print(f"Loading vector store from: {vector_store_path}")
    
    with open(vector_store_path, 'rb') as f:
        vector_store = pickle.load(f)
    
    print("Extracting documents and embeddings...")
    
    # Extract documents with their embeddings
    documents = []
    
    # Get the docstore (contains metadata)
    docstore = vector_store.docstore
    index = vector_store.index
    
    # Get index to docstore ID mapping
    index_to_docstore_id = vector_store.index_to_docstore_id
    
    # Determine number of documents to process
    total_docs = index.ntotal
    print(f"Total documents in vector store: {total_docs}")
    
    # Validate and adjust max_docs
    if max_docs is None or max_docs <= 0 or max_docs > total_docs:
        if max_docs is not None:
            if max_docs <= 0:
                print(f"Warning: max_docs ({max_docs}) is invalid, using all documents")
            elif max_docs > total_docs:
                print(f"Warning: max_docs ({max_docs}) exceeds total documents ({total_docs}), using all documents")
        num_docs = total_docs
    else:
        num_docs = max_docs
    
    print(f"Processing {num_docs} documents...")
    
    for idx in range(num_docs):
        if idx > 0 and idx % 1000 == 0:
            print(f"  Processed {idx}/{num_docs} documents...")
        
        # Get document ID from index
        if idx in index_to_docstore_id:
            doc_id = index_to_docstore_id[idx]
            doc = docstore.search(doc_id)
            
            if doc:
                # Get the embedding vector for this document
                embedding = index.reconstruct(idx)
                
                # Create document entry
                doc_entry = {
                    'id': doc_id,
                    'content': doc.page_content,  # Keep full content for proper search
                    'metadata': doc.metadata,
                    'embedding': embedding.tolist()  # Convert numpy array to list
                }
                documents.append(doc_entry)
    
    print(f"Extracted {len(documents)} documents")
    
    # Create the JSON structure
    json_data = {
        'site': config.SITE_NAME,
        'total_documents': len(documents),
        'embedding_dimension': len(documents[0]['embedding']) if documents else 0,
        'documents': documents
    }
    
    # Save to JSON
    print(f"Saving to JSON: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"✓ JSON export complete! Size: {file_size:.1f} MB")
    
    # Also create a compressed version
    gz_path = output_path + '.gz'
    print(f"Creating compressed version: {gz_path}")
    with gzip.open(gz_path, 'wt', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False)
    
    gz_size = os.path.getsize(gz_path) / 1024 / 1024
    print(f"✓ Compressed JSON saved! Size: {gz_size:.1f} MB")
    
    return json_data


def main():
    # Get default max_docs from site config with validation
    default_max_docs = None
    if site_config and hasattr(site_config, 'VECTOR_STORE_SAMPLE_SIZE'):
        sample_size = site_config.VECTOR_STORE_SAMPLE_SIZE
        if isinstance(sample_size, int) and sample_size > 0:
            default_max_docs = sample_size
        else:
            print(f"Warning: Invalid VECTOR_STORE_SAMPLE_SIZE ({sample_size}) in site config, will use all documents")
    
    parser = argparse.ArgumentParser(
        description='Export vector store to JSON format for web use'
    )
    parser.add_argument(
        '--input',
        default=str(config.DATA_DIR / 'vector_store.pkl'),
        help='Path to vector store pickle file'
    )
    parser.add_argument(
        '--output',
        default=str(config.DATA_DIR / 'vector_store.json'),
        help='Output path for JSON file'
    )
    help_text = 'Maximum number of documents to export'
    if default_max_docs:
        help_text += f' (default: {default_max_docs} from site config)'
    else:
        help_text += ' (default: all documents)'
    
    parser.add_argument(
        '--max-docs',
        type=int,
        default=default_max_docs,
        help=help_text
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Vector store not found at {args.input}")
        print("Please run xml2vec.py first to create the vector store.")
        sys.exit(1)
    
    export_vector_store_to_json(args.input, args.output, args.max_docs)


if __name__ == '__main__':
    main()