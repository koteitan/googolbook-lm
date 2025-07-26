#!/usr/bin/env python3
"""
RAG Search Tool for MediaWiki

This tool implements a Retrieval-Augmented Generation (RAG) system
to search through MediaWiki content using vector similarity.
"""

import os
import sys
import argparse
import pickle
import time
import threading
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
from lib.rag.prompt_builder import create_full_prompt, format_results_with_citations
from lib.io_utils import find_xml_file
from lib.formatting import format_number
import config


def show_loading_spinner():
    """Display a rotating loading spinner."""
    spinner = ['-', '\\', '|', '/']
    i = 0
    while not getattr(show_loading_spinner, 'stop', False):
        sys.stdout.write(f'\rLoading {spinner[i % len(spinner)]}')
        sys.stdout.flush()
        time.sleep(0.1)
        i += 1


def load_vector_store(cache_path: str) -> object:
    """Load vector store from cache file."""
    if not os.path.exists(cache_path):
        raise FileNotFoundError(f"Vector store not found: {cache_path}")
    
    # Start spinner thread
    show_loading_spinner.stop = False
    spinner_thread = threading.Thread(target=show_loading_spinner)
    spinner_thread.daemon = True
    spinner_thread.start()
    
    try:
        with open(cache_path, 'rb') as f:
            result = pickle.load(f)
    finally:
        # Stop spinner
        show_loading_spinner.stop = True
        spinner_thread.join(timeout=0.2)
        sys.stdout.write('\r' + ' ' * 20 + '\r')  # Clear loading line
        sys.stdout.flush()
    
    return result


def format_search_results(results, show_prompt=False):
    """Format search results for display with optional LLM prompt."""
    output = []
    
    # Convert results to the format expected by prompt_builder
    formatted_results = []
    for doc, score in results:
        metadata = doc.metadata
        formatted_results.append({
            'title': metadata.get('title', 'Unknown'),
            'content': doc.page_content,
            'url': metadata.get('url', 'N/A'),
            'score': score
        })
    
    # Show traditional search results
    for i, (doc, score) in enumerate(results, 1):
        output.append(f"\n{'='*60}")
        output.append(f"Result {i} (Score: {score:.4f})")
        output.append(f"{'='*60}")
        
        # Display metadata
        metadata = doc.metadata
        title = metadata.get('title', 'Unknown')
        url = metadata.get('url', 'N/A')
        
        output.append(f"Title: {title}")
        output.append(f"URL: {url}")
        output.append(f"ID: {metadata.get('id', 'N/A')}")
        
        # Display content preview
        content = doc.page_content
        preview_length = 500
        if len(content) > preview_length:
            content = content[:preview_length] + "..."
        
        output.append(f"\nContent Preview:")
        output.append(content)
    
    # Show LLM prompt if requested
    if show_prompt and formatted_results:
        output.append(f"\n{'='*60}")
        output.append("LLM PROMPT CONTEXT (with citations)")
        output.append(f"{'='*60}")
        
        # Use body_results for content-based search
        combined_context, citations = format_results_with_citations(
            title_results=None,
            body_results=formatted_results
        )
        
        output.append("\nContext that would be sent to LLM:")
        output.append(combined_context)
        
        output.append(f"\nCitations generated:")
        for citation in citations:
            output.append(f"[{citation['number']}] {citation['title']} - {citation['url']}")
    
    return '\n'.join(output)


def main():
    parser = argparse.ArgumentParser(
        description=f'Search {config.SITE_NAME} using RAG (Retrieval-Augmented Generation)'
    )
    parser.add_argument(
        'query',
        nargs='?',
        default=None,
        help='Search query'
    )
    parser.add_argument(
        '--cache',
        default=str(config.DATA_DIR / 'vector_store.pkl'),
        help=f'Path to vector store file (default: {config.DATA_DIR}/vector_store.pkl)'
    )
    parser.add_argument(
        '--top-k',
        type=int,
        default=10,
        help='Number of results to return (default: 10)'
    )
    parser.add_argument(
        '--score-threshold',
        type=float,
        help='Minimum similarity score threshold'
    )
    parser.add_argument(
        '--show-prompt',
        action='store_true',
        help='Show the LLM prompt context with citations'
    )
    
    args = parser.parse_args()
    
    try:
        # Load vector store first
        vector_store = load_vector_store(args.cache)
        
        # Single query mode if argument provided
        if args.query is not None:
            results = search_documents(
                vector_store,
                args.query,
                k=args.top_k,
                score_threshold=args.score_threshold
            )
            
            if not results:
                print("No results found.")
            else:
                print(format_search_results(results, show_prompt=args.show_prompt))
        
        # Interactive mode if no argument
        else:
            
            while True:
                try:
                    query = input("> ").strip()
                    
                    if not query:
                        continue
                    
                    if query.lower() in ['quit', 'exit']:
                        break
                    
                    results = search_documents(
                        vector_store,
                        query,
                        k=args.top_k,
                        score_threshold=args.score_threshold
                    )
                    
                    if not results:
                        print("No results found.")
                    else:
                        print(format_search_results(results, show_prompt=args.show_prompt))
                    
                    print()  # Empty line before next prompt
                    
                except KeyboardInterrupt:
                    break
                except EOFError:
                    break
            
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