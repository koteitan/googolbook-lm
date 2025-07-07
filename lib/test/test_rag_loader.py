#!/usr/bin/env python3
"""Test MWDumpLoader metadata extraction"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file
import config

def test_loader():
    xml_path = find_xml_file()
    print(f"Loading from: {xml_path}")
    
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=[0]  # Main namespace only
    )
    
    # Load just first few documents
    documents = loader.load()
    
    print(f"\nLoaded {len(documents)} documents")
    print("\nFirst 3 documents metadata:")
    
    for i, doc in enumerate(documents[:3]):
        print(f"\n--- Document {i+1} ---")
        print(f"Content preview: {doc.page_content[:100]}...")
        print(f"Metadata: {doc.metadata}")
        print(f"Metadata keys: {list(doc.metadata.keys())}")

if __name__ == "__main__":
    test_loader()