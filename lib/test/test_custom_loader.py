#!/usr/bin/env python3
"""Test custom loader with user blog namespace"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag.custom_loader import EnhancedMWDumpLoader
from lib.io_utils import find_xml_file

def test_custom_loader():
    xml_path = find_xml_file()
    print(f"Testing custom loader with User blog namespace (500)")
    
    try:
        loader = EnhancedMWDumpLoader(
            file_path=xml_path,
            namespaces=[500],  # Only User blog
            skip_redirects=False
        )
        
        docs = []
        for doc in loader.load():
            docs.append(doc)
            if len(docs) >= 10:  # Get first 10
                break
        
        print(f"✓ Loaded {len(docs)} documents from custom loader")
        
        for i, doc in enumerate(docs):
            title = doc.metadata.get('title', 'Unknown')
            content_preview = doc.page_content[:50].replace('\n', ' ')
            print(f"  {i+1}. {title}")
            print(f"     Content: {content_preview}...")
            print()
            
    except Exception as e:
        print(f"Error with custom loader: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_custom_loader()