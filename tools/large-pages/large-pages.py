#!/usr/bin/env python3
"""
Large Page Analyzer for Googology Wiki XML Export

This script analyzes the MediaWiki XML export from Googology Wiki to identify
pages with large content sizes and generates a markdown report.
"""

import xml.etree.ElementTree as ET
import os
from typing import List, Tuple

# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'large-pages.md'


def analyze_xml_pages(xml_file_path: str) -> List[Tuple[int, str, str]]:
    """
    Analyze XML file to extract page sizes and titles.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        List of tuples containing (page_size, page_title, namespace)
    """
    pages_data = []
    
    print(f"Analyzing {xml_file_path}...")
    
    # Use iterparse for memory-efficient parsing of large XML files
    context = ET.iterparse(xml_file_path, events=('start', 'end'))
    context = iter(context)
    event, root = next(context)
    
    # Get namespace URI from root element
    namespace_uri = root.tag.split('}')[0] + '}' if root.tag.startswith('{') else ''
    
    page_count = 0
    
    for event, elem in context:
        if event == 'end' and elem.tag == f'{namespace_uri}page':
            page_count += 1
            if page_count % 1000 == 0:
                print(f"Processed {page_count} pages...")
            
            # Extract page information
            title_elem = elem.find(f'{namespace_uri}title')
            ns_elem = elem.find(f'{namespace_uri}ns')
            revision_elem = elem.find(f'{namespace_uri}revision')
            
            if title_elem is not None and revision_elem is not None:
                title = title_elem.text or "Unknown"
                namespace = ns_elem.text or "0"
                
                # Get text content from revision
                text_elem = revision_elem.find(f'{namespace_uri}text')
                if text_elem is not None and text_elem.text:
                    page_size = len(text_elem.text)
                    pages_data.append((page_size, title, namespace))
            
            # Clear element to free memory
            elem.clear()
    
    print(f"Total pages processed: {page_count}")
    print(f"Pages with content: {len(pages_data)}")
    
    return pages_data


def generate_markdown_report(pages_data: List[Tuple[int, str, str]], output_file: str, top_n: int = 100):
    """
    Generate markdown report with largest pages.
    
    Args:
        pages_data: List of (page_size, page_title, namespace) tuples
        output_file: Path to output markdown file
        top_n: Number of top pages to include in report
    """
    # Sort by page size (descending)
    sorted_pages = sorted(pages_data, key=lambda x: x[0], reverse=True)
    
    # Take top N pages
    top_pages = sorted_pages[:top_n]
    
    # Generate markdown content
    markdown_content = f"""# Large Pages Analysis - Googology Wiki

Analysis of the largest pages in the Googology Wiki XML export.

## Summary

- **Total pages analyzed**: {len(pages_data):,}
- **Largest page size**: {sorted_pages[0][0]:,} characters
- **Average page size**: {sum(p[0] for p in pages_data) // len(pages_data):,} characters
- **Top {top_n} largest pages shown below**

## Largest Pages

| Rank | Page Size (chars) | Page Title | Namespace |
|------|------------------|------------|-----------|
"""
    
    for i, (size, title, namespace) in enumerate(top_pages, 1):
        # Escape pipe characters in title for markdown table
        escaped_title = title.replace('|', '\\|')
        namespace_name = get_namespace_name(namespace)
        
        # Create link to Googology Wiki page
        # URL encode the title for the wiki link
        import urllib.parse
        encoded_title = urllib.parse.quote(title.replace(' ', '_'), safe=':/')
        wiki_link = f"https://googology.fandom.com/wiki/{encoded_title}"
        linked_title = f"[{escaped_title}]({wiki_link})"
        
        markdown_content += f"| {i} | {size:,} | {linked_title} | {namespace_name} |\n"
    
    # Add statistics section
    markdown_content += f"""
## Size Distribution

- **Pages over 100KB**: {len([p for p in pages_data if p[0] > 100000])}
- **Pages over 50KB**: {len([p for p in pages_data if p[0] > 50000])}
- **Pages over 10KB**: {len([p for p in pages_data if p[0] > 10000])}
- **Pages over 1KB**: {len([p for p in pages_data if p[0] > 1000])}

## Namespace Distribution (Top {top_n} pages)

"""
    
    # Count namespace distribution in top pages
    namespace_counts = {}
    for _, _, namespace in top_pages:
        ns_name = get_namespace_name(namespace)
        namespace_counts[ns_name] = namespace_counts.get(ns_name, 0) + 1
    
    for ns_name, count in sorted(namespace_counts.items(), key=lambda x: x[1], reverse=True):
        markdown_content += f"- **{ns_name}**: {count} pages\n"
    
    markdown_content += f"""
---

## License and Attribution

This analysis contains content from the **Googology Wiki** (googology.fandom.com), which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

- **Original Source**: [Googology Wiki](https://googology.fandom.com)
- **License**: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution**: Content creators and contributors of the Googology Wiki
- **Modifications**: This analysis extracts and reorganizes data from the original wiki content

*Generated by large-pages.py*  
*Analysis date: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"Report generated: {output_file}")


def get_namespace_name(namespace_id: str) -> str:
    """Convert namespace ID to human-readable name."""
    namespace_map = {
        '0': 'Main',
        '1': 'Talk',
        '2': 'User',
        '3': 'User talk',
        '4': 'Googology Wiki',
        '5': 'Googology Wiki talk',
        '6': 'File',
        '7': 'File talk',
        '8': 'MediaWiki',
        '9': 'MediaWiki talk',
        '10': 'Template',
        '11': 'Template talk',
        '12': 'Help',
        '13': 'Help talk',
        '14': 'Category',
        '15': 'Category talk',
    }
    return namespace_map.get(namespace_id, f'NS{namespace_id}')


def main():
    """Main function to run the analysis."""
    # Use configuration from top of file
    xml_file = XML_FILE
    output_file = OUTPUT_FILE
    
    # Check if XML file exists
    if not os.path.exists(xml_file):
        print(f"Error: XML file not found: {xml_file}")
        return
    
    try:
        # Analyze XML file
        pages_data = analyze_xml_pages(xml_file)
        
        if not pages_data:
            print("No pages found in XML file")
            return
        
        # Generate report
        generate_markdown_report(pages_data, output_file)
        
        print(f"\nAnalysis complete!")
        print(f"Found {len(pages_data)} pages with content")
        print(f"Report saved to: {output_file}")
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()