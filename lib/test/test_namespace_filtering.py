#!/usr/bin/env python3
"""Test namespace filtering in RAG loader"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import load_mediawiki_documents
from lib.io_utils import find_xml_file
import config
from collections import defaultdict

def test_namespace_filtering():
    xml_path = find_xml_file()
    print(f"Loading from: {xml_path}")
    
    # Load documents with new filtering
    documents = load_mediawiki_documents(xml_path)
    
    print(f"\nLoaded {len(documents)} documents after filtering")
    
    # Analyze namespace distribution
    namespace_counts = defaultdict(int)
    namespace_examples = defaultdict(list)
    
    for doc in documents[:1000]:  # Sample first 1000 docs
        if 'source' in doc.metadata:
            title = doc.metadata['source']
            
            # Determine namespace from title
            if ':' in title:
                namespace = title.split(':', 1)[0]
            else:
                namespace = 'Main'
            
            namespace_counts[namespace] += 1
            if len(namespace_examples[namespace]) < 3:
                namespace_examples[namespace].append(title)
    
    print(f"\nNamespace distribution (first 1000 docs):")
    for namespace, count in sorted(namespace_counts.items(), key=lambda x: -x[1]):
        print(f"  {namespace}: {count}")
        print(f"    Examples: {namespace_examples[namespace]}")
        print()
    
    # Specifically look for User blog
    user_blog_docs = [doc for doc in documents[:5000] 
                      if 'source' in doc.metadata and 'User blog:' in doc.metadata['source']]
    
    print(f"\nUser blog documents found: {len(user_blog_docs)}")
    if user_blog_docs:
        print("Examples:")
        for doc in user_blog_docs[:5]:
            print(f"  - {doc.metadata['source']}")
    
    # Check excluded namespaces are actually excluded
    print(f"\nChecking exclusions (EXCLUDED_NAMESPACES):")
    excluded_found = []
    for doc in documents[:1000]:
        if 'source' in doc.metadata:
            title = doc.metadata['source']
            for excluded in config.EXCLUDED_NAMESPACES:
                if title.startswith(excluded + ':'):
                    excluded_found.append(title)
                    break
    
    if excluded_found:
        print(f"ERROR: Found {len(excluded_found)} excluded documents:")
        for title in excluded_found[:5]:
            print(f"  - {title}")
    else:
        print("✓ No excluded namespaces found in results")

if __name__ == "__main__":
    test_namespace_filtering()