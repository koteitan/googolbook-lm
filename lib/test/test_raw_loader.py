#!/usr/bin/env python3
"""Test raw MWDumpLoader behavior"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file
from collections import defaultdict

def test_raw_loader():
    xml_path = find_xml_file()
    print(f"Loading from: {xml_path}")
    
    # Load without namespace filtering
    loader = MWDumpLoader(file_path=xml_path)
    
    # Get first 100 documents to analyze
    docs = []
    for doc in loader.lazy_load():
        docs.append(doc)
        if len(docs) >= 100:
            break
    
    print(f"\nAnalyzing {len(docs)} raw documents:")
    
    # Look for User blog titles
    user_blog_count = 0
    examples = []
    
    for doc in docs:
        title = doc.metadata.get('source', '')
        print(f"Title: {repr(title)}")
        
        if 'User blog' in title:
            user_blog_count += 1
            examples.append(title)
            if len(examples) <= 3:
                print(f"  *** USER BLOG FOUND: {title}")
    
    print(f"\nUser blog documents found: {user_blog_count}")
    print(f"Examples: {examples}")
    
    # Check some title patterns
    title_patterns = defaultdict(int)
    for doc in docs:
        title = doc.metadata.get('source', '')
        if ':' in title:
            prefix = title.split(':', 1)[0]
            title_patterns[prefix] += 1
        else:
            title_patterns['(no prefix)'] += 1
    
    print(f"\nTitle patterns:")
    for pattern, count in sorted(title_patterns.items(), key=lambda x: -x[1]):
        print(f"  {pattern}: {count}")

if __name__ == "__main__":
    test_raw_loader()