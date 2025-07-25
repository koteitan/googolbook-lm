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
import struct
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


def float64_to_float32_base64(float_list):
    """Convert float64 list to base64-encoded float32 binary"""
    import base64
    # Convert to float32 numpy array
    float32_array = np.array(float_list, dtype=np.float32)
    # Get binary representation
    binary_data = float32_array.tobytes()
    # Encode to base64 for JSON compatibility
    base64_data = base64.b64encode(binary_data).decode('utf-8')
    return base64_data


def export_vector_store_to_json(vector_store_path: str, output_path: str, max_chunks: int = None, force_single_part: bool = False, use_binary: bool = False):
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
    if force_single_part:
        num_parts = 1
        chunks_per_part = num_chunks
        print(f"Creating single file (all {num_chunks} chunks)...")
    else:
        num_parts = (num_chunks + chunks_per_part - 1) // chunks_per_part
        print(f"Creating {num_parts} part files...")
    
    # Create metadata file
    meta_data = {
        'total_documents': num_chunks,  # Keep key name for backward compatibility
        'num_parts': num_parts,
        'docs_per_part': chunks_per_part,  # Keep key name for backward compatibility
        'embedding_dimension': embedding_dimension
    }
    
    # Create metadata file with appropriate name
    if '_titles.json' in str(output_path):
        meta_path = output_path.parent / 'vector_store_titles_meta.json'
    else:
        meta_path = output_path.parent / 'vector_store_meta.json'
    with open(meta_path, 'w', encoding='utf-8') as f:
        # No indentation for smaller file size
        json.dump(meta_data, f, separators=(',', ':'))
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
                    
                    # Create minimal document entry - content will be fetched from XML
                    if use_binary:
                        # Convert to float32 binary format
                        doc_entry = {
                            'id': doc_id,
                            'curid': doc.metadata.get('curid'),
                            'embedding_binary': float64_to_float32_base64(embedding),
                            'embedding_format': 'float32_base64'
                        }
                        # Add chunk info only for body chunks
                        if 'chunk_index' in doc.metadata:
                            doc_entry['chunk_index'] = doc.metadata.get('chunk_index', 0)
                            doc_entry['chunk_start'] = doc.metadata.get('chunk_start', 0)
                            doc_entry['chunk_end'] = doc.metadata.get('chunk_end', len(doc.page_content))
                    else:
                        # Original float list format (legacy support)
                        doc_entry = {
                            'id': doc_id,
                            'curid': doc.metadata.get('curid'),
                            'embedding': embedding.tolist()  # Convert numpy array to list
                        }
                        # Add chunk info only for body chunks
                        if 'chunk_index' in doc.metadata:
                            doc_entry['chunk_index'] = doc.metadata.get('chunk_index', 0)
                            doc_entry['chunk_start'] = doc.metadata.get('chunk_start', 0)
                            doc_entry['chunk_end'] = doc.metadata.get('chunk_end', len(doc.page_content))
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
        
        # Save part to JSON with appropriate prefix
        if '_titles.json' in str(output_path):
            part_output_path = output_path.parent / f'vector_store_titles_part{part_idx + 1:02d}.json'
        else:
            part_output_path = output_path.parent / f'vector_store_part{part_idx + 1:02d}.json'
        print(f"  Saving part to JSON: {part_output_path}")
        with open(part_output_path, 'w', encoding='utf-8') as f:
            # No indentation for smaller file size
            json.dump(part_json_data, f, ensure_ascii=False, separators=(',', ':'))
        
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
        # No indentation for smaller file size
        json.dump(meta_data, f, separators=(',', ':'))
    print(f"\nMetadata updated with size information: {meta_path}")
    
    # Determine file prefix for display
    file_prefix = "vector_store_titles_part" if '_titles.json' in str(output_path) else "vector_store_part"
    
    print(f"Files created:")
    print(f"  - {meta_path}")
    for i in range(num_parts):
        print(f"  - {file_prefix}{i + 1:02d}.json")
        print(f"  - {file_prefix}{i + 1:02d}.json.gz")
    
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
    
    parser.add_argument(
        '--title-only',
        action='store_true',
        help='Process title vector store only instead of both (default: process both body and title)'
    )
    
    parser.add_argument(
        '--body-only',
        action='store_true',
        help='Process body vector store only instead of both (default: process both body and title)'
    )
    
    args = parser.parse_args()
    
    if args.title_only:
        # Process title vector store only
        input_path = args.input
        output_path = args.output
        
        # Adjust input path for titles
        if input_path == str(config.DATA_DIR / 'vector_store.pkl'):
            input_path = str(config.DATA_DIR / 'vector_store_titles.pkl')
        elif not input_path.endswith('_titles.pkl'):
            input_path = input_path.replace('.pkl', '_titles.pkl')
        
        # Adjust output path for titles  
        if output_path == str(config.DATA_DIR / 'vector_store.json'):
            output_path = str(config.DATA_DIR / 'vector_store_titles.json')
        elif not output_path.endswith('_titles.json'):
            output_path = output_path.replace('.json', '_titles.json')
        
        if not os.path.exists(input_path):
            print(f"Error: Title vector store not found at {input_path}")
            print("Please run xml2vec.py --title-only first to create the title vector store.")
            sys.exit(1)
        
        print("Processing title vector store only...")
        export_vector_store_to_json(input_path, output_path, args.max_chunks, force_single_part=True, use_binary=True)
        
    elif args.body_only:
        # Process body vector store only
        body_input = args.input
        body_output = args.output
        
        if not os.path.exists(body_input):
            print(f"Error: Body vector store not found at {body_input}")
            print("Please run xml2vec.py --body-only first to create the body vector store.")
            sys.exit(1)
        
        print("Processing body vector store only...")
        export_vector_store_to_json(body_input, body_output, args.max_chunks, use_binary=True)
        
    else:
        # Default: Process both body and title vector stores
        print("Processing both body and title vector stores...")
        
        # Process body vector store
        print("\n=== Processing body vector store ===")
        body_input = args.input
        body_output = args.output
        
        if not os.path.exists(body_input):
            print(f"Error: Body vector store not found at {body_input}")
            print("Please run xml2vec.py first to create the vector stores.")
            sys.exit(1)
        
        export_vector_store_to_json(body_input, body_output, args.max_chunks, use_binary=True)
        
        # Process title vector store
        print("\n=== Processing title vector store ===")
        title_input = args.input.replace('.pkl', '_titles.pkl')
        title_output = args.output.replace('.json', '_titles.json')
        
        if os.path.exists(title_input):
            export_vector_store_to_json(title_input, title_output, args.max_chunks, force_single_part=True, use_binary=True)
            print(f"\n✓ Both vector stores processed successfully!")
        else:
            print(f"Warning: Title vector store not found at {title_input}")
            print("Only body vector store was processed.")


if __name__ == '__main__':
    main()