#!/usr/bin/env python3
"""Test what source titles MWDumpLoader actually returns"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file

def test_raw_source_titles():
    xml_path = find_xml_file()
    print(f"Testing raw source titles from: {xml_path}")
    
    # Load specific namespaces including User blog (500)
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=[0, 500]  # Main and User blog only
    )
    
    docs = []
    user_blog_found = 0
    
    for doc in loader.lazy_load():
        source = doc.metadata.get('source', '')
        
        # Check for User blog
        if 'User blog' in source or source.startswith('User blog'):
            user_blog_found += 1
            print(f"USER BLOG FOUND: source='{source}'")
            if user_blog_found >= 5:  # Stop after finding 5
                break
        
        docs.append(doc)
        if len(docs) >= 500:  # Check first 500 docs
            break
    
    print(f"\nProcessed {len(docs)} documents")
    print(f"User blog documents found: {user_blog_found}")
    
    # Show some source examples
    print(f"\nSource examples:")
    for doc in docs[:10]:
        print(f"  '{doc.metadata.get('source', 'NO SOURCE')}'")

if __name__ == "__main__":
    test_raw_source_titles()