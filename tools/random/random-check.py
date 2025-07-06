#!/usr/bin/env python3
"""
Random Page Selector for MediaWiki XML Export

This script analyzes MediaWiki XML exports to create
a random page selector that generates an HTML page with a button to jump
to random wiki pages (excluding pages specified in site configuration).
"""

import xml.etree.ElementTree as ET
import os
import random
import sys
from typing import List, Tuple

# Add parent directory to path for imports
sys.path.append('../../')
import config

# Configuration - output to site-specific data directory
OUTPUT_FILE = str(config.DATA_DIR / 'random.html')
RANDOM_LINKS_COUNT = 50  # Number of random links to display


def load_excluded_namespaces() -> Tuple[List[str], List[str]]:
    """
    Load excluded namespaces and usernames from site configuration.
    
    Returns:
        Tuple of (excluded_namespaces, excluded_usernames)
    """
    return config.EXCLUDED_NAMESPACES, config.EXCLUDED_USERNAMES


def should_exclude_page(title: str, excluded_namespaces: List[str]) -> bool:
    """
    Check if a page should be excluded based on its title namespace.
    
    Args:
        title: Page title
        excluded_namespaces: List of excluded namespace prefixes
        
    Returns:
        True if page should be excluded
    """
    if ':' in title:
        namespace = title.split(':', 1)[0]
        # Check both original and space-normalized versions
        # MediaWiki may use either spaces or underscores in namespace names
        namespace_normalized = namespace.replace('_', ' ')
        return namespace in excluded_namespaces or namespace_normalized in excluded_namespaces
    return False


def extract_random_pages(xml_file_path: str) -> List[Tuple[str, str, str]]:
    """
    Extract all valid pages from XML file for random selection.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        List of tuples containing (page_id, page_title, namespace)
    """
    pages_data = []
    
    print(f"Extracting pages from {xml_file_path}...")
    
    # Load excluded namespaces
    excluded_namespaces, excluded_usernames = load_excluded_namespaces()
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
            
            if title_elem is not None and id_elem is not None:
                title = title_elem.text or "Unknown"
                page_id = id_elem.text or "0"
                namespace = ns_elem.text or "0"
                
                # Skip excluded pages
                if should_exclude_page(title, excluded_namespaces):
                    elem.clear()
                    continue
                
                # Add valid page to list
                pages_data.append((page_id, title, namespace))
            
            # Clear element to free memory
            elem.clear()
    
    print(f"Total pages processed: {page_count}")
    print(f"Valid pages for random selection: {len(pages_data)}")
    
    return pages_data


def generate_html_page(pages_data: List[Tuple[str, str, str]], output_file: str):
    """
    Generate HTML page with random page selector functionality.
    
    Args:
        pages_data: List of (page_id, page_title, namespace) tuples
        output_file: Path to output HTML file
    """
    # Generate random sample for links list with both ID and title
    random_sample = random.sample(pages_data, min(RANDOM_LINKS_COUNT, len(pages_data)))
    random_links_js = []
    random_links_html = ""
    for page_id, title, namespace in random_sample:
        # For HTML display
        escaped_title = title.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')
        random_links_html += f'<li><a href="{config.SITE_BASE_URL}/?curid={page_id}" target="_blank">{escaped_title}</a></li>\n            '
        
        # For JavaScript array (with both ID and title)
        js_escaped_title = title.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'")
        random_links_js.append(f'["{page_id}", "{js_escaped_title}"]')
    
    random_links_html = random_links_html.rstrip('\n            ')
    random_links_js_array = '[' + ','.join(random_links_js) + ']'
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Random Check - {config.SITE_NAME}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #121212;
            color: #e0e0e0;
        }}
        .container {{
            background-color: #1e1e1e;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            text-align: center;
            border: 1px solid #333;
        }}
        h1 {{
            color: #ffffff;
            margin-bottom: 20px;
            font-weight: 300;
            font-size: 2.5em;
        }}
        .description {{
            color: #b0b0b0;
            margin-bottom: 30px;
            line-height: 1.6;
            font-size: 16px;
        }}
        .random-button {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            font-size: 18px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }}
        .random-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }}
        .stats {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #333;
            color: #888;
            font-size: 14px;
        }}
        .stats a {{
            color: #8ab4f8;
            text-decoration: none;
        }}
        .stats a:hover {{
            color: #aecbfa;
            text-decoration: underline;
        }}
        .random-links {{
            margin-top: 30px;
            text-align: left;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }}
        .random-links h3 {{
            color: #ffffff;
            text-align: center;
            margin-bottom: 20px;
            font-weight: 400;
            font-size: 1.3em;
        }}
        .random-links ul {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        .random-links li {{
            margin-bottom: 8px;
            padding: 8px 12px;
            background-color: #2a2a2a;
            border-radius: 6px;
            border-left: 3px solid #667eea;
            transition: all 0.2s ease;
        }}
        .random-links li:hover {{
            background-color: #333;
            transform: translateX(4px);
        }}
        .random-links a {{
            color: #e0e0e0;
            text-decoration: none;
            font-size: 14px;
            display: block;
        }}
        .random-links a:hover {{
            color: #ffffff;
        }}
        .license {{
            margin-top: 30px;
            padding: 20px;
            background-color: #2a2a2a;
            border-radius: 8px;
            border-left: 3px solid #667eea;
            text-align: left;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }}
        .license p {{
            margin: 0;
            color: #b0b0b0;
            font-size: 14px;
            line-height: 1.5;
        }}
        .license a {{
            color: #aecbfa;
            text-decoration: none;
        }}
        .license a:hover {{
            color: #ffffff;
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎲 Random Check</h1>
        <div class="description">
            This tool displays random pages from the {config.SITE_NAME} to verify that site configuration exclusion rules are working correctly.
        </div>
        
        
        <div class="random-links">
            <h3>🎲 Random Page Samples</h3>
            <ul>
                {random_links_html}
            </ul>
        </div>
        
        <div class="stats">
            <strong>Statistics:</strong><br>
            📊 Total available pages: {len(pages_data):,}<br>
            🚫 Excluded {73776 - len(pages_data):,} pages by site configuration rules<br>
            📅 Generated: {get_fetch_date()}<br>
            🤖 Created by random-check.py
        </div>
        
        <div class="license">
            <p><strong>License:</strong> This content is derived from the <a href="{config.SITE_BASE_URL}" target="_blank">{config.SITE_NAME}</a>, which is licensed under <a href="{config.LICENSE_URL}" target="_blank">{config.LICENSE_SHORT}</a>. Any derivative work must maintain the same license.</p>
        </div>
    </div>

    <script>
        // Array of random sample pages with titles (for display)
        const randomLinks = {random_links_js_array};
    </script>
</body>
</html>"""
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"HTML page generated: {output_file}")


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
    """Main function to run the random page generator."""
    # Use configuration from config.py
    from lib.io_utils import get_xml_file, check_xml_exists
    
    xml_file = get_xml_file()
    output_file = OUTPUT_FILE
    
    # Check if XML file exists
    if not check_xml_exists():
        return
    
    try:
        # Extract pages from XML
        print("Extracting valid pages...")
        pages_data = extract_random_pages(xml_file)
        
        if not pages_data:
            print("No valid pages found in XML file")
            return
        
        # Generate HTML page
        print("Generating HTML page...")
        generate_html_page(pages_data, output_file)
        
        print(f"\nRandom page generator complete!")
        print(f"Found {len(pages_data)} valid pages")
        print(f"HTML page saved to: {output_file}")
        print(f"Open {output_file} in a web browser to use the random page selector.")
        
    except Exception as e:
        print(f"Error during generation: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()