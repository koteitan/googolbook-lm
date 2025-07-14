#!/usr/bin/env python3
"""Test if MWDumpLoader provides page ID metadata"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file
import config

def test_page_id_metadata():
    xml_path = find_xml_file()
    
    # Test with a small subset
    namespace_filter = [0, 500]  # Main and User blog
    
    print("Testing page ID metadata from MWDumpLoader...")
    loader = MWDumpLoader(file_path=xml_path, namespaces=namespace_filter)
    docs = loader.load()
    
    print(f"Loaded {len(docs)} documents")
    
    # Check first 10 docs for all metadata
    for i, doc in enumerate(docs[:10]):
        print(f"\nDocument {i+1}:")
        print(f"  Source: {doc.metadata.get('source', 'NO SOURCE')}")
        print(f"  All metadata keys: {list(doc.metadata.keys())}")
        print(f"  All metadata values: {doc.metadata}")
        
        # Check if there's any ID-like field
        for key, value in doc.metadata.items():
            if 'id' in key.lower() or str(value).isdigit():
                print(f"  Potential ID field: {key} = {value}")

if __name__ == "__main__":
    test_page_id_metadata()