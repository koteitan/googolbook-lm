#!/usr/bin/env python3
"""Test loading only User blog namespace"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import load_mediawiki_documents
from lib.io_utils import find_xml_file

def test_user_blog_only():
    xml_path = find_xml_file()
    print(f"Loading User blog namespace (500) from: {xml_path}")
    
    # Load only User blog namespace (500)
    try:
        documents = load_mediawiki_documents(xml_path, namespace_filter=[500])
        print(f"✓ Loaded {len(documents)} User blog documents")
        
        if documents:
            print("\nFirst 5 User blog documents:")
            for i, doc in enumerate(documents[:5]):
                title = doc.metadata.get('title', 'Unknown')
                content_preview = doc.page_content[:100].replace('\n', ' ')
                print(f"  {i+1}. {title}")
                print(f"     Content: {content_preview}...")
                print()
        else:
            print("No User blog documents found")
            
    except Exception as e:
        print(f"Error loading User blog namespace: {e}")

if __name__ == "__main__":
    test_user_blog_only()