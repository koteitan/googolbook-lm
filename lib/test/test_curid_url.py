#!/usr/bin/env python3
"""Test curid URL generation"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag.loader import build_title_to_page_id_mapping
from lib.io_utils import find_xml_file

def test_curid_url():
    xml_path = "/mnt/c/code/koteitan.github.io/googolbook-lm/data/googology-wiki/googology_pages_current.xml"
    
    # Build title-to-ID mapping
    title_to_id = build_title_to_page_id_mapping(xml_path)
    
    # Test some examples
    test_titles = [
        "Googology",
        "User blog:TheRealLfey/uhhh so I'm quite new to googology and i created ss or something",
        "Main Page",
        "User blog:List of googolisms/Class 2"
    ]
    
    print("Testing curid URL generation:")
    for title in test_titles:
        page_id = title_to_id.get(title)
        if page_id:
            url = f'https://googology.fandom.com/wiki/?curid={page_id}'
            print(f"\nTitle: {title}")
            print(f"Page ID: {page_id}")
            print(f"URL: {url}")
        else:
            print(f"\nTitle: {title}")
            print(f"Page ID: NOT FOUND")

if __name__ == "__main__":
    test_curid_url()