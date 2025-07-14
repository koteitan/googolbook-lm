#!/usr/bin/env python3
"""Test User blog URL fix"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file
from lib.xml_parser import parse_namespaces
import config

def test_user_blog_url_fix():
    xml_path = find_xml_file()
    namespace_mapping = parse_namespaces(xml_path)
    
    # Test with Main + User blog namespaces
    namespace_filter = [0, 500]  # Main and User blog
    
    print("Testing User blog URL fix...")
    loader = MWDumpLoader(file_path=xml_path, namespaces=namespace_filter)
    docs = loader.load()
    
    # Create reverse mapping: namespace ID -> namespace name
    id_to_name = {int(ns_id): ns_name for ns_id, ns_name in namespace_mapping.items() if ns_id.isdigit()}
    
    print(f"Namespace mapping: {id_to_name}")
    
    # Find some User blog examples
    user_blog_examples = []
    for doc in docs:
        if 'source' in doc.metadata:
            source_title = doc.metadata['source']
            
            # Apply same logic as in loader.py
            if ('/' in source_title and 500 in namespace_filter and 500 in id_to_name):
                # This is likely from User blog namespace
                full_title = f"{id_to_name[500]}:{source_title}"
                url_title = full_title.replace(" ", "_")
                url = f'{config.SITE_BASE_URL}/wiki/{url_title}'
                
                user_blog_examples.append({
                    'source': source_title,
                    'full_title': full_title,
                    'url': url
                })
                
                if len(user_blog_examples) >= 5:
                    break
    
    print(f"\nFound {len(user_blog_examples)} User blog examples:")
    for i, example in enumerate(user_blog_examples, 1):
        print(f"\n{i}. Source: {example['source']}")
        print(f"   Full title: {example['full_title']}")
        print(f"   URL: {example['url']}")

if __name__ == "__main__":
    test_user_blog_url_fix()