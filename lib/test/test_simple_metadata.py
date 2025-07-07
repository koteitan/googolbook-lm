#!/usr/bin/env python3
"""Test simple metadata enhancement"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file
import config

def test_simple():
    xml_path = find_xml_file()
    
    # Use standard loader
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=[0]
    )
    
    # Load just a few
    docs = []
    for doc in loader.lazy_load():
        docs.append(doc)
        if len(docs) >= 5:
            break
    
    print("Original metadata:")
    for i, doc in enumerate(docs):
        print(f"\nDoc {i+1}:")
        print(f"  source: {doc.metadata.get('source', 'N/A')}")
        print(f"  content: {doc.page_content[:50]}...")
    
    print("\n\nEnhanced metadata:")
    for i, doc in enumerate(docs):
        if 'source' in doc.metadata:
            title = doc.metadata['source']
            print(f"\nDoc {i+1}:")
            print(f"  title: {title}")
            print(f"  url: {config.SITE_BASE_URL}/wiki/{title.replace(' ', '_')}")
            print(f"  id: page_{title.replace(' ', '_')}")

if __name__ == "__main__":
    test_simple()