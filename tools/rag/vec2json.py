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
try:
    from lib.config_loader import get_site_config
    site_config = get_site_config()
except (ImportError, FileNotFoundError) as e:
    print(f"Warning: Could not load site config: {e}")
    site_config = None


def export_vector_store_to_json(vector_store_path: str, output_path: str, max_chunks: int = None):
    """
    Export vector store to JSON format.
    
    Args:
        vector_store_path: Path to the vector store pickle file
        output_path: Path for the output JSON file
        max_chunks: Maximum number of chunks to export (None for all)
    """
    print(f"Loading vector store from: {vector_store_path}")
    
    # Convert output_path to Path object if it's a string
    if isinstance(output_path, str):
        output_path = Path(output_path)
    
    with open(vector_store_path, 'rb') as f:
        vector_store = pickle.load(f)
    
    print("Extracting chunks and embeddings...")
    
    # Extract documents with their embeddings
    documents = []
    
    # Get the docstore (contains metadata)
    docstore = vector_store.docstore
    index = vector_store.index
    
    # Get index to docstore ID mapping
    index_to_docstore_id = vector_store.index_to_docstore_id
    
    # Determine number of chunks to process
    total_chunks = index.ntotal
    embedding_dimension = index.d  # Get embedding dimension from FAISS index
    print(f"Total chunks in vector store: {total_chunks}")
    print(f"Embedding dimension: {embedding_dimension}")
    
    # Validate and adjust max_chunks
    if max_chunks is None or max_chunks <= 0 or max_chunks > total_chunks:
        if max_chunks is not None:
            if max_chunks <= 0:
                print(f"Warning: max_chunks ({max_chunks}) is invalid, using all chunks")
            elif max_chunks > total_chunks:
                print(f"Warning: max_chunks ({max_chunks}) exceeds total chunks ({total_chunks}), using all chunks")
        num_chunks = total_chunks
    else:
        num_chunks = max_chunks
    
    # Get chunks per part from site configuration
    chunks_per_part = getattr(site_config, 'DOCUMENTS_PER_PART', 10000)
    
    print(f"Processing {num_chunks} chunks in parts of {chunks_per_part}...")
    
    # Calculate number of parts needed
    num_parts = (num_chunks + chunks_per_part - 1) // chunks_per_part
    print(f"Creating {num_parts} part files...")
    
    # Create metadata file
    meta_data = {
        'total_documents': num_chunks,  # Keep key name for backward compatibility
        'num_parts': num_parts,
        'docs_per_part': chunks_per_part,  # Keep key name for backward compatibility
        'embedding_dimension': embedding_dimension
    }
    
    meta_path = output_path.parent / 'vector_store_meta.json'
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_data, f, indent=2)
    print(f"Metadata written to: {meta_path}")
    
    # Track total file sizes
    total_json_size = 0
    total_gz_size = 0
    
    # Process chunks in parts
    for part_idx in range(num_parts):
        part_start = part_idx * chunks_per_part
        part_end = min(part_start + chunks_per_part, num_chunks)
        part_size = part_end - part_start
        
        print(f"\nProcessing part {part_idx + 1}/{num_parts} ({part_size} chunks)...")
        
        part_chunks = []
        
        for idx in range(part_start, part_end):
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
                    part_chunks.append(doc_entry)
        
        print(f"  Part {part_idx + 1}: Extracted {len(part_chunks)} chunks")
        
        # Create the JSON structure for this part
        part_json_data = {
            'site': site_config.SITE_NAME if site_config else 'Unknown Site',
            'part_index': part_idx,
            'part_documents': len(part_chunks),  # Keep key name for backward compatibility
            'embedding_dimension': embedding_dimension,
            'documents': part_chunks  # Keep key name for backward compatibility
        }
        
        # Save part to JSON  
        part_output_path = output_path.parent / f'vector_store_part{part_idx + 1:02d}.json'
        print(f"  Saving part to JSON: {part_output_path}")
        with open(part_output_path, 'w', encoding='utf-8') as f:
            json.dump(part_json_data, f, ensure_ascii=False, indent=2)
        
        part_file_size = os.path.getsize(part_output_path) / 1024 / 1024
        total_json_size += part_file_size
        print(f"  ✓ Part {part_idx + 1} JSON complete! Size: {part_file_size:.1f} MB")
        
        # Also create a compressed version for this part
        part_gz_path = str(part_output_path) + '.gz'
        print(f"  Creating compressed version: {part_gz_path}")
        with gzip.open(part_gz_path, 'wt', encoding='utf-8') as f:
            json.dump(part_json_data, f, ensure_ascii=False)
        
        part_gz_size = os.path.getsize(part_gz_path) / 1024 / 1024
        total_gz_size += part_gz_size
        print(f"  ✓ Part {part_idx + 1} compression complete! Size: {part_gz_size:.1f} MB")
    
    print(f"\n✓ All {num_parts} parts created successfully!")
    print(f"Total sizes:")
    print(f"  - JSON files: {total_json_size:.1f} MB")
    print(f"  - Compressed files: {total_gz_size:.1f} MB")
    
    # Update metadata with size information
    meta_data['total_json_size_mb'] = round(total_json_size, 1)
    meta_data['total_gz_size_mb'] = round(total_gz_size, 1)
    
    # Rewrite metadata with size information
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_data, f, indent=2)
    print(f"\nMetadata updated with size information: {meta_path}")
    
    print(f"Files created:")
    print(f"  - {meta_path}")
    for i in range(num_parts):
        print(f"  - vector_store_part{i + 1:02d}.json")
        print(f"  - vector_store_part{i + 1:02d}.json.gz")
    
    return meta_data


def main():
    # Get default max_chunks from site config with validation
    default_max_chunks = None
    if site_config and hasattr(site_config, 'VECTOR_STORE_SAMPLE_SIZE'):
        sample_size = site_config.VECTOR_STORE_SAMPLE_SIZE
        if isinstance(sample_size, int):
            if sample_size == -1:
                print(f"Using VECTOR_STORE_SAMPLE_SIZE ({sample_size}) from site config: export all chunks")
                default_max_chunks = -1  # Will be converted to all chunks in export function
            elif sample_size > 0:
                print(f"Using VECTOR_STORE_SAMPLE_SIZE ({sample_size}) from site config")
                default_max_chunks = sample_size
            else:
                print(f"Warning: Invalid VECTOR_STORE_SAMPLE_SIZE ({sample_size}) in site config, will use all chunks")
        else:
            print(f"Warning: Invalid VECTOR_STORE_SAMPLE_SIZE ({sample_size}) in site config, will use all chunks")
    
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
    help_text = 'Maximum number of chunks to export'
    if default_max_chunks:
        help_text += f' (default: {default_max_chunks} from site config)'
    else:
        help_text += ' (default: all chunks)'
    
    parser.add_argument(
        '--max-chunks',
        type=int,
        default=default_max_chunks,
        help=help_text
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Vector store not found at {args.input}")
        print("Please run xml2vec.py first to create the vector store.")
        sys.exit(1)
    
    export_vector_store_to_json(args.input, args.output, args.max_chunks)


if __name__ == '__main__':
    main()