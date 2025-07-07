#!/usr/bin/env python3
"""Debug namespace filter construction"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.xml_parser import parse_namespaces
from lib.io_utils import find_xml_file
import config

def debug_namespace_filter():
    xml_path = find_xml_file()
    print(f"Debugging namespace filter construction")
    print(f"EXCLUDED_NAMESPACES: {config.EXCLUDED_NAMESPACES}")
    
    # Parse namespaces from XML
    namespace_mapping = parse_namespaces(xml_path)
    print(f"\nParsed {len(namespace_mapping)} namespaces from XML:")
    
    # Show all namespaces
    for ns_id, ns_name in sorted(namespace_mapping.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
        print(f"  ID {ns_id}: '{ns_name}'")
    
    # Build filter like in loader.py
    excluded_namespaces = set(config.EXCLUDED_NAMESPACES)
    print(f"\nExcluded namespace set: {excluded_namespaces}")
    
    included_ns_ids = []
    print(f"\nNamespace inclusion logic:")
    for ns_id, ns_name in namespace_mapping.items():
        try:
            ns_id_int = int(ns_id)
            is_excluded = ns_name in excluded_namespaces
            if not is_excluded:
                included_ns_ids.append(ns_id_int)
                print(f"  ✓ Include ID {ns_id} ({ns_name})")
            else:
                print(f"  ❌ Exclude ID {ns_id} ({ns_name})")
        except ValueError:
            print(f"  ⚠️  Skip non-numeric ID {ns_id} ({ns_name})")
    
    print(f"\nFinal namespace_filter: {sorted(included_ns_ids)}")
    
    # Check specific namespaces
    user_blog_id = None
    for ns_id, ns_name in namespace_mapping.items():
        if ns_name == 'User blog':
            user_blog_id = ns_id
            break
    
    if user_blog_id:
        print(f"\nUser blog namespace found: ID {user_blog_id}")
        if int(user_blog_id) in included_ns_ids:
            print(f"  ✓ User blog IS included in filter")
        else:
            print(f"  ❌ User blog is NOT included in filter")
    else:
        print(f"\n❌ User blog namespace NOT found in XML")

if __name__ == "__main__":
    debug_namespace_filter()