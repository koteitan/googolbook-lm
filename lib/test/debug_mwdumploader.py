#!/usr/bin/env python3
"""Debug MWDumpLoader behavior with namespace filter"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from langchain_community.document_loaders import MWDumpLoader
from lib.io_utils import find_xml_file

def debug_mwdumploader():
    xml_path = find_xml_file()
    
    print("Testing MWDumpLoader with different namespace filters:")
    
    # Test 1: Only main namespace
    print(f"\n1. Testing with Main namespace only [0]:")
    loader1 = MWDumpLoader(file_path=xml_path, namespaces=[0])
    docs1 = loader1.load()
    print(f"   Loaded {len(docs1)} documents")
    
    # Test 2: Only User blog namespace
    print(f"\n2. Testing with User blog namespace only [500]:")
    loader2 = MWDumpLoader(file_path=xml_path, namespaces=[500])
    docs2 = loader2.load()
    print(f"   Loaded {len(docs2)} documents")
    if docs2:
        print(f"   First few titles:")
        for i, doc in enumerate(docs2[:3]):
            print(f"     - {doc.metadata.get('source', 'NO SOURCE')}")
    else:
        print(f"   ❌ No User blog documents found!")
    
    # Test 3: Main + User blog
    print(f"\n3. Testing with Main + User blog [0, 500]:")
    loader3 = MWDumpLoader(file_path=xml_path, namespaces=[0, 500])
    docs3 = loader3.load()
    print(f"   Loaded {len(docs3)} documents")
    print(f"   Expected: {len(docs1)} + {len(docs2)} = {len(docs1) + len(docs2)}")
    
    # Test 4: With negative namespaces (problematic?)
    print(f"\n4. Testing with negative namespace [-2, 0, 500]:")
    try:
        loader4 = MWDumpLoader(file_path=xml_path, namespaces=[-2, 0, 500])
        docs4 = loader4.load()
        print(f"   Loaded {len(docs4)} documents")
    except Exception as e:
        print(f"   ❌ Error with negative namespaces: {e}")
    
    # Test 5: Our full filter without negatives
    full_filter_no_negatives = [0, 1, 2, 4, 13, 500, 502, 503, 1200, 1201, 1202, 2901]
    print(f"\n5. Testing with full filter (no negatives): {full_filter_no_negatives}")
    loader5 = MWDumpLoader(file_path=xml_path, namespaces=full_filter_no_negatives)
    docs5 = loader5.load()
    print(f"   Loaded {len(docs5)} documents")

if __name__ == "__main__":
    debug_mwdumploader()