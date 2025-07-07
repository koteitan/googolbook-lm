#!/usr/bin/env python3
"""Test namespace exclusion based on EXCLUDED_NAMESPACES"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag import load_mediawiki_documents
from lib.io_utils import find_xml_file
from lib.xml_parser import parse_namespaces
import config
from collections import defaultdict

def test_namespace_exclusion():
    xml_path = find_xml_file()
    print(f"Testing namespace exclusion from: {xml_path}")
    print(f"EXCLUDED_NAMESPACES: {config.EXCLUDED_NAMESPACES}")
    
    # First, show what namespaces exist
    namespace_mapping = parse_namespaces(xml_path)
    print(f"\nAvailable namespaces:")
    for ns_id, ns_name in sorted(namespace_mapping.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
        excluded = "EXCLUDED" if ns_name in config.EXCLUDED_NAMESPACES else "included"
        print(f"  {ns_id}: {ns_name} ({excluded})")
    
    # Load documents with new filtering
    try:
        print(f"\nLoading documents...")
        documents = load_mediawiki_documents(xml_path)
        
        # Analyze namespace distribution
        namespace_counts = defaultdict(int)
        examples = defaultdict(list)
        
        for doc in documents[:2000]:  # Sample first 2000
            title = doc.metadata.get('title', '')
            
            if ':' in title:
                prefix = title.split(':', 1)[0]
            else:
                prefix = 'Main'
            
            namespace_counts[prefix] += 1
            if len(examples[prefix]) < 3:
                examples[prefix].append(title)
        
        print(f"\nNamespace distribution (first 2000 docs):")
        for ns, count in sorted(namespace_counts.items(), key=lambda x: -x[1]):
            excluded = "❌ SHOULD BE EXCLUDED" if ns in config.EXCLUDED_NAMESPACES else "✓"
            print(f"  {ns}: {count} {excluded}")
            for example in examples[ns][:2]:
                print(f"    - {example}")
            print()
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_namespace_exclusion()