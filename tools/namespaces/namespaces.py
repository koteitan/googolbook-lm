#!/usr/bin/env python3
"""
Namespace Analysis for MediaWiki XML Export

This script analyzes MediaWiki XML exports to break down
content by namespace, showing the distribution of bytes and pages across
different types of wiki content.
"""

import os
import random
from datetime import datetime
from typing import Dict, Tuple, List

# Import shared library modules
import sys
sys.path.append('../../')
import config
from lib.xml_parser import parse_namespaces, get_namespace_name, iterate_pages
from lib.formatting import format_number, format_bytes
from lib.io_utils import get_fetch_date, check_xml_exists, get_xml_file
from lib.reporting import generate_license_footer, write_markdown_report

# Local configuration - output to site-specific data directory
OUTPUT_FILE = str(config.DATA_DIR / 'namespaces.md')

# Removed - now imported from lib.io_utils

# Removed - now imported from lib.xml_parser

def analyze_namespaces(xml_file_path: str) -> Tuple[Dict[str, Tuple[int, int]], Dict[str, List[Tuple[str, str]]]]:
    """
    Analyze XML file to extract namespace statistics and sample pages.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        Tuple of (namespace_stats, namespace_samples)
        - namespace_stats: Dictionary mapping namespace names to (total_bytes, page_count) tuples
        - namespace_samples: Dictionary mapping namespace names to lists of (page_id, title) tuples
    """
    print(f"Analyzing {xml_file_path}...")
    
    # Parse namespace definitions from XML
    print("Parsing namespace definitions...")
    namespace_map = parse_namespaces(xml_file_path)
    print(f"Found {len(namespace_map)} namespace definitions")
    
    # Dictionary to store namespace data: namespace -> (total_bytes, page_count)
    namespace_stats = {}
    # Dictionary to store sample pages: namespace -> list of (page_id, title)
    namespace_samples = {}
    
    # Process XML file using shared iterator
    for page_count, elements in iterate_pages(xml_file_path):
        if elements['ns'] and elements['title'] and elements['id']:
            # Get namespace name from parsed definitions
            namespace_name = get_namespace_name(elements['ns'], elements['title'], namespace_map)
            
            # Get page content size
            content_size = 0
            if elements['text']:
                content_size = len(elements['text'].encode('utf-8'))
            
            # Update namespace statistics
            if namespace_name not in namespace_stats:
                namespace_stats[namespace_name] = (0, 0)
                namespace_samples[namespace_name] = []
            
            current_bytes, current_pages = namespace_stats[namespace_name]
            namespace_stats[namespace_name] = (current_bytes + content_size, current_pages + 1)
            
            # Collect page samples for examples
            namespace_samples[namespace_name].append((elements['id'], elements['title']))
    
    return namespace_stats, namespace_samples

# Removed - now imported from lib.xml_parser

# Removed - now imported from lib.formatting

def generate_report(namespace_stats: Dict[str, Tuple[int, int]], namespace_samples: Dict[str, List[Tuple[str, str]]], output_file: str):
    """
    Generate markdown report from namespace statistics.
    
    Args:
        namespace_stats: Dictionary of namespace -> (bytes, pages) data
        namespace_samples: Dictionary of namespace -> list of (page_id, title) samples
        output_file: Path to output markdown file
    """
    # Sort by total bytes (descending)
    sorted_namespaces = sorted(namespace_stats.items(), key=lambda x: x[1][0], reverse=True)
    
    # Calculate totals
    total_bytes = sum(bytes_count for bytes_count, _ in namespace_stats.values())
    total_pages = sum(page_count for _, page_count in namespace_stats.values())
    
    # Calculate total pages after exclusion using proper exclusion system
    excluded_namespaces_for_calc = set(config.EXCLUDED_NAMESPACES)
    
    # Calculate total bytes and pages after exclusion
    total_bytes_after_exclude = sum(
        bytes_count for namespace, (bytes_count, page_count) in sorted_namespaces 
        if namespace not in excluded_namespaces_for_calc
    )
    total_pages_after_exclude = sum(
        page_count for namespace, (bytes_count, page_count) in sorted_namespaces 
        if namespace not in excluded_namespaces_for_calc
    )
    
    # Calculate excluded content size and pages
    excluded_content_size = total_bytes - total_bytes_after_exclude
    excluded_pages = total_pages - total_pages_after_exclude
    
    # Generate report content
    report_content = f"""# Namespace Analysis

Analysis of content distribution across namespaces in the {config.SITE_NAME} XML export.

## Summary

- **Total namespaces analyzed**: {len(namespace_stats):,}
- **Total pages**: {total_pages:,}
- **Total content size**: {format_bytes(total_bytes)}
- **Excluded content size**: {format_bytes(excluded_content_size)}
- **Excluded pages**: {excluded_pages:,}
- **Total content size after exclude**: {format_bytes(total_bytes_after_exclude)}
- **Total pages after exclude**: {total_pages_after_exclude:,}

## Namespace Breakdown

| Namespace | MBytes | Pages | % | % after exclude | Examples |
|-----------|--------|-------|---|-----------------|----------|
"""
    
    for namespace, (bytes_count, page_count) in sorted_namespaces:
        mbytes = bytes_count / (1024 * 1024)
        percentage = (bytes_count / total_bytes * 100) if total_bytes > 0 else 0
        
        # Calculate percentage after exclude (only for non-excluded namespaces)
        if namespace in excluded_namespaces_for_calc:
            percentage_after_exclude_str = "—"
        else:
            percentage_after_exclude = (bytes_count / total_bytes_after_exclude * 100) if total_bytes_after_exclude > 0 else 0
            percentage_after_exclude_str = f"{percentage_after_exclude:.1f}"
        
        # Get random samples for examples
        samples = namespace_samples.get(namespace, [])
        if len(samples) >= 3:
            random_samples = random.sample(samples, 3)
        else:
            random_samples = samples
        
        # Format examples as links
        example_links = []
        for page_id, title in random_samples:
            # Truncate title if too long
            display_title = title if len(title) <= 30 else title[:27] + "..."
            example_links.append(f"[{page_id}]({config.SITE_BASE_URL}/?curid={page_id})")
        
        examples_str = ", ".join(example_links) if example_links else "—"
        
        report_content += f"| {namespace} | {mbytes:.1f} | {page_count:,} | {percentage:.1f} | {percentage_after_exclude_str} | {examples_str} |\n"
    
    # Add license and metadata
    report_content += f"""
## Analysis Summary

### Largest Namespaces by Content
The top 5 namespaces by total content size:

"""
    
    for i, (namespace, (bytes_count, page_count)) in enumerate(sorted_namespaces[:5], 1):
        percentage = (bytes_count / total_bytes * 100) if total_bytes > 0 else 0
        report_content += f"{i}. **{namespace}**: {format_bytes(bytes_count)} ({percentage:.1f}% of total content)\n"
    
    report_content += f"""
### Content Distribution
- **Main articles** represent the core wiki content
- **User pages** include individual contributor pages and user blogs
- **Talk pages** contain discussion and collaboration content
- **Template and Category pages** support wiki structure and organization
"""
    
    # Add license footer
    report_content += generate_license_footer('namespaces.py')
    
    # Write report to file
    write_markdown_report(output_file, report_content)

def main():
    """Main function to run the namespace analysis."""
    print("Starting namespace analysis...")
    
    # Check if XML file exists
    if not check_xml_exists():
        return
    
    # Analyze namespaces
    xml_file = get_xml_file()
    namespace_stats, namespace_samples = analyze_namespaces(xml_file)
    
    # Generate report
    generate_report(namespace_stats, namespace_samples, OUTPUT_FILE)
    
    print(f"\nAnalysis complete!")
    print(f"Found {len(namespace_stats)} namespaces")
    print(f"Report saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()