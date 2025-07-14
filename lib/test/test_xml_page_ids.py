#!/usr/bin/env python3
"""Test extracting page IDs from XML directly"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.io_utils import find_xml_file
from lib.xml_parser import iterate_pages, extract_page_elements
import config

def test_xml_page_ids():
    xml_path = find_xml_file()
    
    print("Testing page ID extraction from XML...")
    print(f"XML file: {xml_path}")
    
    # Check first 10 pages
    count = 0
    for page_count, elements in iterate_pages(xml_path, show_progress=False):
        if count >= 10:
            break
            
        if elements.get('id') and elements.get('title'):
            title = elements['title']
            page_id = elements['id']
            namespace = elements.get('ns', 'unknown')
            
            print(f"\nPage {count + 1}:")
            print(f"  Title: {title}")
            print(f"  Page ID: {page_id}")
            print(f"  Namespace: {namespace}")
            
            # Generate curid URL
            curid_url = f"https://googology.fandom.com/ja/?curid={page_id}"
            print(f"  Curid URL: {curid_url}")
            
            count += 1

if __name__ == "__main__":
    test_xml_page_ids()