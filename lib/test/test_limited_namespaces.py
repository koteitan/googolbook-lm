#!/usr/bin/env python3
"""Test loading main + user blog namespaces"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import load_mediawiki_documents
from lib.io_utils import find_xml_file
from collections import defaultdict

def test_limited_namespaces():
    xml_path = find_xml_file()
    print(f"Loading limited namespaces from: {xml_path}")
    
    try:
        documents = load_mediawiki_documents(xml_path)  # Use default namespace_filter
        print(f"✓ Loaded {len(documents)} documents")
        
        # Count by namespace prefix
        namespace_counts = defaultdict(int)
        examples = defaultdict(list)
        
        for doc in documents[:1000]:  # Sample first 1000
            title = doc.metadata.get('title', '')
            
            if ':' in title:
                prefix = title.split(':', 1)[0]
            else:
                prefix = 'Main'
            
            namespace_counts[prefix] += 1
            if len(examples[prefix]) < 3:
                examples[prefix].append(title)
        
        print(f"\nNamespace distribution (first 1000 docs):")
        for ns, count in sorted(namespace_counts.items(), key=lambda x: -x[1]):
            print(f"  {ns}: {count}")
            for example in examples[ns]:
                print(f"    - {example}")
            print()
        
        # Check for User blog specifically
        user_blog_docs = [doc for doc in documents[:2000]
                         if 'title' in doc.metadata and doc.metadata['title'].startswith('User blog:')]
        
        print(f"User blog documents found: {len(user_blog_docs)}")
        if user_blog_docs:
            print("Examples:")
            for doc in user_blog_docs[:3]:
                print(f"  - {doc.metadata['title']}")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_limited_namespaces()