#!/usr/bin/env python3
"""
Random Page Selector for Googology Wiki XML Export

This script analyzes the MediaWiki XML export from Googology Wiki to create
a random page selector that generates an HTML page with a button to jump
to random wiki pages (excluding pages specified in exclude.md).
"""

import xml.etree.ElementTree as ET
import os
import random
from typing import List, Tuple

# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'index.html'
FETCH_LOG_FILE = '../../data/fetch_log.txt'
EXCLUDE_FILE = '../../exclude.md'


def load_excluded_namespaces(exclude_file_path: str) -> Tuple[List[str], List[str]]:
    """
    Load excluded namespaces and usernames from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file
        
    Returns:
        Tuple of (excluded_namespaces, excluded_usernames)
    """
    excluded_namespaces = []
    excluded_usernames = []
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- ') and ':' in line:
                    if '<username>' in line and '</username>' in line:
                        # Extract username from lines like "- FANDOM system pages: `<username>FANDOM</username>`"
                        start = line.find('<username>') + len('<username>')
                        end = line.find('</username>')
                        if start > len('<username>') - 1 and end > start:
                            username = line[start:end]
                            excluded_usernames.append(username)
                    else:
                        # Extract namespace from lines like "- User talk: `<title>User talk:*</title>`"
                        namespace = line.split(':')[0].replace('- ', '').strip()
                        excluded_namespaces.append(namespace)
    except Exception as e:
        print(f"Warning: Could not load exclusions from {exclude_file_path}: {e}")
    return excluded_namespaces, excluded_usernames


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
        return namespace in excluded_namespaces
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
    excluded_namespaces, excluded_usernames = load_excluded_namespaces(EXCLUDE_FILE)
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
            if page_count % 1000 == 0:
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
    # Convert pages data to JavaScript array (only page IDs needed)
    js_pages = []
    for page_id, title, namespace in pages_data:
        js_pages.append(f'"{page_id}"')
    
    pages_js_array = '[' + ','.join(js_pages) + ']'
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Random Googology Wiki Page</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }}
        h1 {{
            color: #333;
            margin-bottom: 20px;
        }}
        .description {{
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }}
        .random-button {{
            background-color: #4CAF50;
            color: white;
            padding: 15px 30px;
            font-size: 18px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }}
        .random-button:hover {{
            background-color: #45a049;
        }}
        .stats {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #888;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎲 Random Googology Wiki Page</h1>
        <div class="description">
            Discover random pages from the Googology Wiki! Click the button below to jump to a randomly selected page from the wiki's vast collection of mathematical concepts and large numbers.
        </div>
        
        <button class="random-button" onclick="goToRandomPage()">
            🎯 Go to Random Page
        </button>
        
        <div class="stats">
            <strong>Statistics:</strong><br>
            📊 Total available pages: {len(pages_data):,}<br>
            🚫 Excluded system/talk/file pages as per exclude.md<br>
            📅 Generated: {get_fetch_date()}<br>
            🤖 Created by random.py
        </div>
    </div>

    <script>
        // Array of all available page IDs
        const pages = {pages_js_array};
        
        function goToRandomPage() {{
            if (pages.length === 0) {{
                alert('No pages available!');
                return;
            }}
            
            // Select random page
            const randomIndex = Math.floor(Math.random() * pages.length);
            const pageId = pages[randomIndex];
            
            // Navigate to the page in background tab
            const url = `https://googology.fandom.com/?curid=${{pageId}}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }}
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
        with open(FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'


def main():
    """Main function to run the random page generator."""
    # Use configuration from top of file
    xml_file = XML_FILE
    output_file = OUTPUT_FILE
    
    # Check if XML file exists
    if not os.path.exists(xml_file):
        print(f"Error: XML file not found: {xml_file}")
        print("Please run tools/fetch/fetch.py to download the XML data first.")
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