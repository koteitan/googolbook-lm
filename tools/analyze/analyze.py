#!/usr/bin/env python3
"""
Namespace Analysis for Googology Wiki XML Export

This script analyzes the MediaWiki XML export from Googology Wiki to break down
content by namespace, showing the distribution of bytes and pages across
different types of wiki content.
"""

import xml.etree.ElementTree as ET
import os
from datetime import datetime
from typing import Dict, Tuple

# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'analyze.md'
FETCH_LOG_FILE = '../../data/fetch_log.txt'

def get_fetch_date() -> str:
    """
    Get the fetch date from the fetch log file.
    
    Returns:
        Fetch date string, or 'Unknown' if not available
    """
    try:
        with open(FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'

def parse_namespaces(xml_file_path: str) -> Dict[str, str]:
    """
    Parse namespace definitions from XML file.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        Dictionary mapping namespace IDs to names
    """
    namespace_map = {}
    
    for event, elem in ET.iterparse(xml_file_path, events=('start', 'end')):
        if event == 'end' and elem.tag.endswith('}namespace'):
            key = elem.get('key')
            name = elem.text
            if key is not None:
                # Handle main namespace (key="0" has no text content)
                if name is None or name.strip() == '':
                    namespace_map[key] = 'Main'
                else:
                    namespace_map[key] = name
            elem.clear()
        elif event == 'end' and elem.tag.endswith('}page'):
            # Stop parsing after first page (namespaces are defined before pages)
            break
    
    return namespace_map

def analyze_namespaces(xml_file_path: str) -> Dict[str, Tuple[int, int]]:
    """
    Analyze XML file to extract namespace statistics.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        Dictionary mapping namespace names to (total_bytes, page_count) tuples
    """
    print(f"Analyzing {xml_file_path}...")
    
    # Parse namespace definitions from XML
    print("Parsing namespace definitions...")
    namespace_map = parse_namespaces(xml_file_path)
    print(f"Found {len(namespace_map)} namespace definitions")
    
    # Dictionary to store namespace data: namespace -> (total_bytes, page_count)
    namespace_stats = {}
    
    # Process XML file using iterparse for memory efficiency
    for event, elem in ET.iterparse(xml_file_path, events=('start', 'end')):
        if event == 'end' and elem.tag.endswith('}page'):
            # Extract namespace and title
            ns_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}ns')
            title_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}title')
            
            if ns_elem is not None and title_elem is not None:
                ns_id = ns_elem.text
                title = title_elem.text
                
                # Get namespace name from parsed definitions
                namespace_name = get_namespace_name(ns_id, title, namespace_map)
                
                # Get page content size
                text_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}text')
                content_size = 0
                if text_elem is not None and text_elem.text is not None:
                    content_size = len(text_elem.text.encode('utf-8'))
                
                # Update namespace statistics
                if namespace_name not in namespace_stats:
                    namespace_stats[namespace_name] = (0, 0)
                
                current_bytes, current_pages = namespace_stats[namespace_name]
                namespace_stats[namespace_name] = (current_bytes + content_size, current_pages + 1)
            
            # Clear element to save memory
            elem.clear()
    
    return namespace_stats

def get_namespace_name(ns_id: str, title: str, namespace_map: Dict[str, str]) -> str:
    """
    Get human-readable namespace name from namespace ID and title.
    
    Args:
        ns_id: Namespace ID as string
        title: Page title
        namespace_map: Mapping of namespace IDs to names from XML
        
    Returns:
        Human-readable namespace name
    """
    # Handle special cases for user blogs
    if ':' in title:
        prefix = title.split(':', 1)[0]
        if prefix == 'User blog':
            return 'User blog'
    
    # Use the namespace map parsed from XML
    return namespace_map.get(ns_id, f'Namespace {ns_id}')

def format_bytes(bytes_count: int) -> str:
    """
    Format byte count in human-readable format.
    
    Args:
        bytes_count: Number of bytes
        
    Returns:
        Formatted string with appropriate unit
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} TB"

def generate_report(namespace_stats: Dict[str, Tuple[int, int]], output_file: str):
    """
    Generate markdown report from namespace statistics.
    
    Args:
        namespace_stats: Dictionary of namespace -> (bytes, pages) data
        output_file: Path to output markdown file
    """
    # Sort by total bytes (descending)
    sorted_namespaces = sorted(namespace_stats.items(), key=lambda x: x[1][0], reverse=True)
    
    # Calculate totals
    total_bytes = sum(bytes_count for bytes_count, _ in namespace_stats.values())
    total_pages = sum(page_count for _, page_count in namespace_stats.values())
    
    # Generate report content
    report_content = f"""# Namespace Analysis

Analysis of content distribution across namespaces in the Googology Wiki XML export.

## Summary

- **Total namespaces analyzed**: {len(namespace_stats):,}
- **Total pages**: {total_pages:,}
- **Total content size**: {format_bytes(total_bytes)}

## Namespace Breakdown

| Namespace | kBytes | Pages | Percentage |
|-----------|--------|-------|------------|
"""
    
    for namespace, (bytes_count, page_count) in sorted_namespaces:
        kbytes = bytes_count / 1024
        percentage = (bytes_count / total_bytes * 100) if total_bytes > 0 else 0
        
        report_content += f"| {namespace} | {kbytes:.1f} | {page_count:,} | {percentage:.1f} |\n"
    
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
- **Main articles** represent the core googology content
- **User pages** include individual contributor pages and user blogs
- **Talk pages** contain discussion and collaboration content
- **Template and Category pages** support wiki structure and organization

---

## License and Attribution

This analysis contains content from the **Googology Wiki** (googology.fandom.com), which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

- **Original Source**: [Googology Wiki](https://googology.fandom.com)
- **License**: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution**: Content creators and contributors of the Googology Wiki
- **Modifications**: This analysis extracts and reorganizes data from the original wiki content

*Archive fetched: {get_fetch_date()}*  
*Generated by analyze.py*  
*Analysis date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Write report to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"Report generated: {output_file}")

def main():
    """Main function to run the namespace analysis."""
    print("Starting namespace analysis...")
    
    # Check if XML file exists
    if not os.path.exists(XML_FILE):
        print(f"Error: XML file not found at {XML_FILE}")
        print("Please run the fetch tool first to download the data.")
        return
    
    # Analyze namespaces
    namespace_stats = analyze_namespaces(XML_FILE)
    
    # Generate report
    generate_report(namespace_stats, OUTPUT_FILE)
    
    print(f"\nAnalysis complete!")
    print(f"Found {len(namespace_stats)} namespaces")
    print(f"Report saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()