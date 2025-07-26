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
import gzip
import shutil
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import (
    load_mediawiki_documents,
    split_documents,
    create_vector_store
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from lib.io_utils import find_xml_file
from lib.formatting import format_number
from lib.config_loader import get_site_config
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
    
    # Load tokenization configuration
    site_config = get_site_config(config.CURRENT_SITE)
    tokenize_config = getattr(site_config, 'tokenize', {'mode': 'normal'})
    
    print(f"Tokenization mode: {tokenize_config.get('mode', 'normal')}")
    
    print(f"Loading documents from: {xml_path}")
    documents = load_mediawiki_documents(xml_path)  # Use default namespace_filter (all except excluded)
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
        use_openai=use_openai,
        tokenize_config=tokenize_config
    )
    
    print(f"Saving vector store to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save as regular pickle
    with open(output_path, 'wb') as f:
        pickle.dump(vector_store, f)
    print(f"✓ Vector store saved successfully!")
    print(f"  File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
    
    # Also save compressed version for web
    gz_path = output_path + '.gz'
    print(f"Creating compressed version: {gz_path}")
    with gzip.open(gz_path, 'wb') as f:
        pickle.dump(vector_store, f)
    print(f"✓ Compressed vector store saved!")
    print(f"  Compressed size: {os.path.getsize(gz_path) / 1024 / 1024:.1f} MB")
    
    return vector_store


def create_and_save_title_vector_store(
    xml_path: str,
    output_path: str,
    use_openai: bool = False,
    embedding_model: str = "all-MiniLM-L6-v2",
    title_embedding_dim: int = 384  # Keep full dimension to match query embeddings
):
    """Create title-only vector store from XML and save to disk."""
    
    # Load tokenization configuration
    site_config = get_site_config(config.CURRENT_SITE)
    tokenize_config = getattr(site_config, 'tokenize', {'mode': 'normal'})
    
    print(f"Creating title vector store...")
    print(f"Tokenization mode: {tokenize_config.get('mode', 'normal')}")
    
    print(f"Loading documents from: {xml_path}")
    documents = load_mediawiki_documents(xml_path)
    print(f"✓ Loaded {format_number(len(documents))} documents")
    
    # Create title-based documents (title + full content for better search)
    title_documents = []
    for doc in documents:
        if hasattr(doc, 'metadata') and doc.metadata and 'title' in doc.metadata:
            # Create a document with title and full content for title-based search
            # This allows title search to return meaningful content, not just titles
            title_doc = type(doc)(
                page_content=doc.page_content,  # Use full content, not just title
                metadata=doc.metadata
            )
            title_documents.append(title_doc)
    
    print(f"✓ Created {format_number(len(title_documents))} title documents")
    
    print(f"Creating title vector store...")
    if use_openai:
        print("  Using OpenAI embeddings")
    else:
        print(f"  Using HuggingFace embeddings: {embedding_model}")
    
    title_vector_store = create_vector_store(
        title_documents, 
        embedding_model=embedding_model,
        use_openai=use_openai,
        tokenize_config=tokenize_config
    )
    
    # Apply PCA dimension reduction for titles to reduce file size
    if title_embedding_dim < 384:  # Only if reduction is needed (disabled for now to avoid dimension mismatch)
        print(f"Applying PCA dimension reduction: 384 → {title_embedding_dim}")
        from sklearn.decomposition import PCA
        import numpy as np
        
        # Get embeddings from vector store
        embeddings = []
        for idx in range(title_vector_store.index.ntotal):
            if idx in title_vector_store.index_to_docstore_id:
                embedding = title_vector_store.index.reconstruct(idx)
                embeddings.append(embedding)
        
        if len(embeddings) > 0:
            embeddings_array = np.array(embeddings)
            
            # Apply PCA
            pca = PCA(n_components=title_embedding_dim)
            reduced_embeddings = pca.fit_transform(embeddings_array)
            
            print(f"PCA explained variance ratio: {pca.explained_variance_ratio_.sum():.3f}")
            
            # Create new FAISS index with reduced dimensions
            import faiss
            new_index = faiss.IndexFlatIP(title_embedding_dim)
            new_index.add(reduced_embeddings.astype('float32'))
            
            # Update vector store with reduced index
            title_vector_store.index = new_index
            
            print(f"✓ Dimension reduction complete: {embeddings_array.shape[1]} → {title_embedding_dim}")
            
            # Save PCA model for query transformation
            pca_path = output_path.replace('.pkl', '_pca.pkl')
            with open(pca_path, 'wb') as f:
                pickle.dump(pca, f)
            print(f"✓ PCA model saved: {pca_path}")
        else:
            print("Warning: No embeddings found for dimension reduction")
    
    print(f"Saving title vector store to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save as regular pickle
    with open(output_path, 'wb') as f:
        pickle.dump(title_vector_store, f)
    print(f"✓ Title vector store saved successfully!")
    print(f"  File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
    
    # Create metadata file for title vector store
    actual_embedding_dim = title_vector_store.index.d if hasattr(title_vector_store.index, 'd') else title_embedding_dim
    meta_data = {
        'total_documents': len(title_documents),
        'num_parts': 1,  # Title vector store is single file
        'docs_per_part': len(title_documents),
        'embedding_dimension': actual_embedding_dim
    }
    
    # Save metadata with _titles suffix
    meta_path = output_path.replace('.pkl', '_meta.json')
    import json
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_data, f, indent=2)
    print(f"✓ Title metadata saved: {meta_path}")
    
    return title_vector_store


def create_both_vector_stores(
    xml_path: str,
    body_output: str,
    title_output: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    use_openai: bool = False,
    embedding_model: str = "all-MiniLM-L6-v2",
    title_embedding_dim: int = 384
):
    """Create both body and title vector stores from single XML read."""
    
    # Load tokenization configuration
    site_config = get_site_config(config.CURRENT_SITE)
    tokenize_config = getattr(site_config, 'tokenize', {'mode': 'normal'})
    
    print(f"Loading documents from: {xml_path}")
    print(f"Tokenization mode: {tokenize_config.get('mode', 'normal')}")
    
    # Single XML read for both body and title processing
    documents = load_mediawiki_documents(xml_path)
    print(f"✓ Loaded {format_number(len(documents))} documents")
    
    # Split documents for body chunks and title processing
    print("\n=== Processing body chunks ===")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    
    body_chunks = text_splitter.split_documents(documents)
    print(f"✓ Created {format_number(len(body_chunks))} body chunks")
    
    print("\n=== Processing title documents ===")
    title_documents = []
    for doc in documents:
        if hasattr(doc, 'metadata') and doc.metadata and 'title' in doc.metadata:
            title_doc = Document(
                page_content=doc.page_content,  # Use full content, not just title
                metadata=doc.metadata.copy()
            )
            title_documents.append(title_doc)
    
    print(f"✓ Created {format_number(len(title_documents))} title documents")
    
    # Create body vector store
    print(f"\n=== Creating body vector store ===")
    if use_openai:
        print("  Using OpenAI embeddings")
    else:
        print(f"  Using HuggingFace embeddings: {embedding_model}")
    
    body_vector_store = create_vector_store(
        body_chunks,
        embedding_model=embedding_model,
        use_openai=use_openai,
        tokenize_config=tokenize_config
    )
    
    # Save body vector store
    print(f"Saving body vector store to: {body_output}")
    os.makedirs(os.path.dirname(body_output), exist_ok=True)
    
    with open(body_output, 'wb') as f:
        pickle.dump(body_vector_store, f)
    print(f"✓ Body vector store saved successfully!")
    print(f"  File size: {os.path.getsize(body_output) / 1024 / 1024:.1f} MB")
    
    # Create title vector store with dimension reduction
    print(f"\n=== Creating title vector store ===")
    title_vector_store = create_vector_store(
        title_documents, 
        embedding_model=embedding_model,
        use_openai=use_openai,
        tokenize_config=tokenize_config
    )
    
    # Apply PCA dimension reduction for titles (disabled for now to avoid dimension mismatch)
    if title_embedding_dim < 384:
        print(f"Applying PCA dimension reduction: 384 → {title_embedding_dim}")
        from sklearn.decomposition import PCA
        import numpy as np
        
        # Get embeddings from vector store
        embeddings = []
        for idx in range(title_vector_store.index.ntotal):
            if idx in title_vector_store.index_to_docstore_id:
                embedding = title_vector_store.index.reconstruct(idx)
                embeddings.append(embedding)
        
        if len(embeddings) > 0:
            embeddings_array = np.array(embeddings)
            
            # Apply PCA
            pca = PCA(n_components=title_embedding_dim)
            reduced_embeddings = pca.fit_transform(embeddings_array)
            
            print(f"PCA explained variance ratio: {pca.explained_variance_ratio_.sum():.3f}")
            
            # Create new FAISS index with reduced dimensions
            import faiss
            new_index = faiss.IndexFlatIP(title_embedding_dim)
            new_index.add(reduced_embeddings.astype('float32'))
            
            # Update vector store with reduced index
            title_vector_store.index = new_index
            
            print(f"✓ Dimension reduction complete: {embeddings_array.shape[1]} → {title_embedding_dim}")
            
            # Save PCA model for query transformation  
            pca_path = title_output.replace('.pkl', '_pca.pkl')
            with open(pca_path, 'wb') as f:
                pickle.dump(pca, f)
            print(f"✓ PCA model saved: {pca_path}")
    
    # Save title vector store
    print(f"Saving title vector store to: {title_output}")
    os.makedirs(os.path.dirname(title_output), exist_ok=True)
    
    with open(title_output, 'wb') as f:
        pickle.dump(title_vector_store, f)
    print(f"✓ Title vector store saved successfully!")
    print(f"  File size: {os.path.getsize(title_output) / 1024 / 1024:.1f} MB")
    
    # Create metadata files
    # Body metadata
    body_meta_data = {
        'total_documents': len(body_chunks),
        'num_parts': 1,
        'docs_per_part': len(body_chunks),
        'embedding_dimension': body_vector_store.index.d if hasattr(body_vector_store.index, 'd') else 384
    }
    
    body_meta_path = body_output.replace('.pkl', '_meta.json')
    import json
    with open(body_meta_path, 'w', encoding='utf-8') as f:
        json.dump(body_meta_data, f, indent=2)
    print(f"✓ Body metadata saved: {body_meta_path}")
    
    # Title metadata
    actual_title_dim = title_vector_store.index.d if hasattr(title_vector_store.index, 'd') else title_embedding_dim
    title_meta_data = {
        'total_documents': len(title_documents),
        'num_parts': 1,
        'docs_per_part': len(title_documents),
        'embedding_dimension': actual_title_dim
    }
    
    title_meta_path = title_output.replace('.pkl', '_meta.json')
    with open(title_meta_path, 'w', encoding='utf-8') as f:
        json.dump(title_meta_data, f, indent=2)
    print(f"✓ Title metadata saved: {title_meta_path}")
    
    return body_vector_store, title_vector_store


def compress_xml_file(xml_path: str):
    """Create a gzipped version of the XML file for web use."""
    gz_path = str(xml_path) + '.gz'
    
    print(f"\nCreating compressed XML file for web use...")
    print(f"  Source: {xml_path}")
    print(f"  Output: {gz_path}")
    
    # Get original file size
    original_size = os.path.getsize(xml_path) / (1024 * 1024)  # MB
    
    # Compress the file
    with open(xml_path, 'rb') as f_in:
        with gzip.open(gz_path, 'wb', compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Get compressed file size
    compressed_size = os.path.getsize(gz_path) / (1024 * 1024)  # MB
    compression_ratio = (1 - compressed_size / original_size) * 100
    
    print(f"✓ XML compression complete!")
    print(f"  Original size: {original_size:.1f} MB")
    print(f"  Compressed size: {compressed_size:.1f} MB")
    print(f"  Compression ratio: {compression_ratio:.1f}%")
    
    return gz_path


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
        '--title-only',
        action='store_true',
        help='Create title-only vector store instead of both (default: create both body and title)'
    )
    
    parser.add_argument(
        '--body-only',
        action='store_true',
        help='Create body-only vector store instead of both (default: create both body and title)'
    )
    
    args = parser.parse_args()
    
    # Always overwrite existing vector store
    if os.path.exists(args.output):
        print(f"Overwriting existing vector store: {args.output}")
    
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
        if args.title_only:
            # Create title-only vector store
            title_output = args.output.replace('.pkl', '_titles.pkl')
            create_and_save_title_vector_store(
                xml_path,
                title_output,
                use_openai=args.use_openai,
                embedding_model=args.embedding_model,
                title_embedding_dim=384  # Keep full dimension to match query embeddings
            )
            print(f"\\nTitle vector store created successfully!")
            print(f"Output: {title_output}")
        elif args.body_only:
            # Create body-only vector store
            create_and_save_vector_store(
                xml_path,
                args.output,
                chunk_size=args.chunk_size,
                chunk_overlap=args.chunk_overlap,
                use_openai=args.use_openai,
                embedding_model=args.embedding_model
            )
            print(f"\\nBody vector store created successfully!")
            print(f"Output: {args.output}")
        else:
            # Default: Create both body and title vector stores in one pass
            print("Creating both body and title vector stores in one pass...")
            title_output = args.output.replace('.pkl', '_titles.pkl')
            create_both_vector_stores(
                xml_path,
                body_output=args.output,
                title_output=title_output,
                chunk_size=args.chunk_size,
                chunk_overlap=args.chunk_overlap,
                use_openai=args.use_openai,
                embedding_model=args.embedding_model,
                title_embedding_dim=384  # Keep full dimension to match query embeddings
            )
            
            print(f"\n✓ Both vector stores created successfully!")
            print(f"Body output: {args.output}")
            print(f"Title output: {title_output}")
        
        # Create compressed XML file for web use
        compress_xml_file(xml_path)
        
        print(f"\nVector store created successfully!")
        print(f"Now you can search using:")
        print(f"  python tools/rag/rag_search.py 'What is Graham\\'s Number?' --cache {args.output}")
        
    except Exception as e:
        print(f"Error creating vector store: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
