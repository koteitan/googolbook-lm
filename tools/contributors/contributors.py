#!/usr/bin/env python3
"""
Contributors Analyzer for Googology Wiki XML Export

This script analyzes the MediaWiki XML export from Googology Wiki to identify
contributors with the highest page creation counts for content curation purposes.
"""

import os
import random
import urllib.parse
import xml.etree.ElementTree as ET
from typing import List, Tuple, Dict
from collections import defaultdict

# Import shared library modules
import sys
sys.path.append('../../')
import config
from lib.exclusions import load_exclusions, should_exclude_page, should_exclude_contributor
from lib.xml_parser import iterate_pages, extract_page_elements
from lib.formatting import format_number
from lib.io_utils import get_fetch_date
from lib.reporting import generate_license_footer, write_markdown_report

# Local configuration
OUTPUT_FILE = 'contributors.md'
HIGH_VOLUME_THRESHOLD = 1000  # Minimum pages to be considered high-volume contributor


# Removed - now imported from lib.exclusions


# Removed - now imported from lib.exclusions


# Removed - now imported from lib.exclusions


def analyze_contributors(xml_file_path: str) -> Tuple[Dict[str, int], Dict[str, List[Tuple[str, str]]]]:
    """
    Analyze XML file to extract contributor page creation counts and page examples.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        Tuple of (contributor_counts, contributor_pages) where:
        - contributor_counts: Dictionary mapping contributor names to page creation counts
        - contributor_pages: Dictionary mapping contributor names to lists of (page_title, page_id) tuples
    """
    contributors = defaultdict(int)
    contributor_pages = defaultdict(list)
    
    print(f"Analyzing {xml_file_path}...")
    
    # Load excluded namespaces and usernames
    excluded_namespaces, excluded_usernames = load_exclusions()
    if excluded_namespaces:
        print(f"Excluding namespaces: {excluded_namespaces}")
    if excluded_usernames:
        print(f"Excluding usernames: {excluded_usernames}")
    
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
            if page_count % 10000 == 0:
                print(f"Processed {page_count} pages...")
            
            # Extract page information
            title_elem = elem.find(f'{namespace_uri}title')
            ns_elem = elem.find(f'{namespace_uri}ns')
            id_elem = elem.find(f'{namespace_uri}id')
            
            # Find all revisions and get the earliest one (original creator)
            revisions = elem.findall(f'{namespace_uri}revision')
            if revisions and title_elem is not None and id_elem is not None:
                title = title_elem.text or "Unknown"
                page_id = id_elem.text or "0"
                namespace = ns_elem.text or "0"
                
                # Skip excluded pages
                if should_exclude_page(title, excluded_namespaces):
                    elem.clear()
                    continue
                
                # Sort revisions by timestamp to find the first one
                revision_data = []
                for revision in revisions:
                    timestamp_elem = revision.find(f'{namespace_uri}timestamp')
                    contributor_elem = revision.find(f'{namespace_uri}contributor')
                    
                    if timestamp_elem is not None and contributor_elem is not None:
                        timestamp = timestamp_elem.text or ""
                        
                        # Get contributor name (either username or IP)
                        username_elem = contributor_elem.find(f'{namespace_uri}username')
                        ip_elem = contributor_elem.find(f'{namespace_uri}ip')
                        
                        if username_elem is not None and username_elem.text:
                            contributor_name = username_elem.text
                        elif ip_elem is not None and ip_elem.text:
                            contributor_name = f"IP:{ip_elem.text}"
                        else:
                            contributor_name = "Unknown"
                        
                        revision_data.append((timestamp, contributor_name))
                
                # Find the earliest revision (page creator)
                if revision_data:
                    revision_data.sort()  # Sort by timestamp
                    earliest_contributor = revision_data[0][1]
                    
                    # Skip excluded contributors
                    if should_exclude_contributor(earliest_contributor, excluded_usernames):
                        elem.clear()
                        continue
                    
                    contributors[earliest_contributor] += 1
                    contributor_pages[earliest_contributor].append((title, page_id))
            
            # Clear element to free memory
            elem.clear()
    
    print(f"Total pages processed: {page_count}")
    print(f"Unique contributors found: {len(contributors)}")
    
    return dict(contributors), dict(contributor_pages)


def generate_markdown_report(contributors_data: Dict[str, int], contributor_pages: Dict[str, List[Tuple[str, str]]], output_file: str, top_n: int = 100):
    """
    Generate markdown report with top contributors by page creation count.
    
    Args:
        contributors_data: Dictionary of contributor names to page counts
        contributor_pages: Dictionary of contributor names to lists of (title, id) tuples
        output_file: Path to output markdown file
        top_n: Number of top contributors to include in report
    """
    # Sort contributors by page count (descending)
    sorted_contributors = sorted(contributors_data.items(), key=lambda x: x[1], reverse=True)
    
    # Take top N contributors
    top_contributors = sorted_contributors[:top_n]
    
    # Calculate statistics
    total_contributors = len(contributors_data)
    total_pages = sum(contributors_data.values())
    avg_pages = total_pages // total_contributors if total_contributors > 0 else 0
    most_active = sorted_contributors[0] if sorted_contributors else ("Unknown", 0)
    
    # Generate markdown content
    markdown_content = f"""# contributors

Analysis of contributors by page creation count in the Googology Wiki XML export.

## Summary

- **Total contributors analyzed**: {total_contributors:,}
- **Total pages created**: {total_pages:,}

## Top Contributors by Page Creation Count

| Rank | Contributor | Pages Created | Percentage of Total | Page Examples |
|------|------------|---------------|-------------------|---------------|
"""
    
    for i, (contributor, count) in enumerate(top_contributors, 1):
        # Escape pipe characters in contributor name for markdown table
        escaped_contributor = contributor.replace('|', '\\|')
        percentage = (count / total_pages * 100) if total_pages > 0 else 0
        
        # Create link to contributor page
        if contributor.startswith('IP:'):
            # For IP addresses, just display as text
            linked_contributor = escaped_contributor
        else:
            # For registered users, create link to user page
            encoded_contributor = urllib.parse.quote(contributor.replace(' ', '_'), safe=':/')
            user_link = f"https://googology.fandom.com/wiki/User:{encoded_contributor}"
            linked_contributor = f"[{escaped_contributor}]({user_link})"
        
        # Get random page examples
        pages = contributor_pages.get(contributor, [])
        if len(pages) > 10:
            example_pages = random.sample(pages, 10)
        else:
            example_pages = pages
        
        # Create page ID links to wiki pages using curid
        linked_examples = []
        for title, page_id in example_pages[:10]:
            page_link = f"https://googology.fandom.com/?curid={page_id}"
            linked_examples.append(f"[{page_id}]({page_link})")
        
        examples_text = ", ".join(linked_examples)
        
        markdown_content += f"| {i} | {linked_contributor} | {count:,} | {percentage:.1f}% | {examples_text} |\n"
    
    # Add curation analysis
    markdown_content += f"""
## Analysis for Content Curation

### High-Volume Contributors
Contributors who created more than {HIGH_VOLUME_THRESHOLD} pages may warrant review for potential automated content generation:

"""
    
    high_volume_contributors = [contrib for contrib, count in sorted_contributors if count > HIGH_VOLUME_THRESHOLD]
    if high_volume_contributors:
        for i, (contributor, count) in enumerate(sorted_contributors):
            if count > HIGH_VOLUME_THRESHOLD:
                escaped_contributor = contributor.replace('|', '\\|')
                markdown_content += f"- **{escaped_contributor}**: {count:,} pages\n"
    else:
        markdown_content += f"- No contributors with more than {HIGH_VOLUME_THRESHOLD} pages found\n"
    
    # Add distribution statistics
    markdown_content += f"""
### Contribution Distribution

- **Contributors with 1 page**: {len([c for c in contributors_data.values() if c == 1])}
- **Contributors with 2-10 pages**: {len([c for c in contributors_data.values() if 2 <= c <= 10])}
- **Contributors with 11-50 pages**: {len([c for c in contributors_data.values() if 11 <= c <= 50])}
- **Contributors with 51+ pages**: {len([c for c in contributors_data.values() if c > 50])}

### User vs Anonymous Contributors

"""
    
    registered_users = len([name for name in contributors_data.keys() if not name.startswith('IP:')])
    anonymous_users = len([name for name in contributors_data.keys() if name.startswith('IP:')])
    
    markdown_content += f"- **Registered users**: {registered_users:,}\n"
    markdown_content += f"- **Anonymous users (IP addresses)**: {anonymous_users:,}\n"
    
    markdown_content += f"""
---

## License and Attribution

This analysis contains content from the **Googology Wiki** (googology.fandom.com), which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

- **Original Source**: [Googology Wiki](https://googology.fandom.com)
- **License**: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution**: Content creators and contributors of the Googology Wiki
- **Modifications**: This analysis extracts and reorganizes data from the original wiki content

*Archive fetched: {get_fetch_date()}*  
*Generated by contributors.py*  
*Analysis date: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"Report generated: {output_file}")


def get_fetch_date() -> str:
    """
    Get the fetch date from the fetch log file.
    
    Returns:
        Fetch date string, or 'Unknown' if not available
    """
    try:
        with open(config.FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'


def main():
    """Main function to run the contributor analysis."""
    # Use configuration from top of file
    xml_file = config.XML_FILE
    output_file = OUTPUT_FILE
    
    # Check if XML file exists
    if not os.path.exists(xml_file):
        print(f"Error: XML file not found: {xml_file}")
        print("Please run tools/fetch/fetch.py to download the XML data first.")
        return
    
    try:
        # Analyze contributors
        print("Analyzing contributors...")
        contributors_data, contributor_pages = analyze_contributors(xml_file)
        
        if not contributors_data:
            print("No contributors found in XML file")
            return
        
        # Generate report
        print("Generating report...")
        generate_markdown_report(contributors_data, contributor_pages, output_file)
        
        print(f"\nAnalysis complete!")
        print(f"Found {len(contributors_data)} contributors")
        print(f"Report saved to: {output_file}")
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()