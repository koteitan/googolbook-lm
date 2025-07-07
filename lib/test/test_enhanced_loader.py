#!/usr/bin/env python3
"""Test enhanced MediaWiki loader"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import load_mediawiki_documents
from lib.io_utils import find_xml_file

def test_enhanced_loader():
    xml_path = find_xml_file()
    print(f"Loading from: {xml_path}")
    
    # Load first few documents
    documents = load_mediawiki_documents(xml_path, namespace_filter=[0])
    
    # Show first 5 non-redirect documents with content
    shown = 0
    for i, doc in enumerate(documents):
        if shown >= 5:
            break
        
        if len(doc.page_content.strip()) > 50:  # Skip very short pages
            print(f"\n--- Document {shown+1} ---")
            print(f"Title: {doc.metadata.get('title', 'N/A')}")
            print(f"ID: {doc.metadata.get('id', 'N/A')}")
            print(f"URL: {doc.metadata.get('url', 'N/A')}")
            print(f"Timestamp: {doc.metadata.get('timestamp', 'N/A')}")
            print(f"Content preview: {doc.page_content[:100]}...")
            shown += 1

if __name__ == "__main__":
    test_enhanced_loader()