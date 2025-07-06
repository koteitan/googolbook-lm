"""
XML parsing utilities for MediaWiki XML exports.
"""

import xml.etree.ElementTree as ET
from typing import Dict, Generator, Tuple, Optional
from .config import MEDIAWIKI_NS, PROGRESS_INTERVAL


def parse_namespaces(xml_file_path: str) -> Dict[str, str]:
    """
    Parse namespace definitions from MediaWiki XML.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        Dictionary mapping namespace keys to namespace names
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
            break  # Stop after siteinfo section
            
    return namespace_map


def iterate_pages(xml_file_path: str, show_progress: bool = True) -> Generator[ET.Element, None, None]:
    """
    Iterate through pages in MediaWiki XML with memory management.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        show_progress: Whether to show progress reports
        
    Yields:
        Page elements from the XML
    """
    page_count = 0
    
    for event, elem in ET.iterparse(xml_file_path, events=('start', 'end')):
        if event == 'end' and elem.tag == f'{MEDIAWIKI_NS}page':
            page_count += 1
            
            if show_progress and page_count % PROGRESS_INTERVAL == 0:
                print(f"Processed {page_count:,} pages...")
            
            yield elem
            elem.clear()


def extract_page_elements(page_elem: ET.Element) -> Dict[str, Optional[str]]:
    """
    Extract common elements from a page element.
    
    Args:
        page_elem: Page element from MediaWiki XML
        
    Returns:
        Dictionary with extracted page data
    """
    ns_elem = page_elem.find(f'.//{MEDIAWIKI_NS}ns')
    title_elem = page_elem.find(f'.//{MEDIAWIKI_NS}title')
    id_elem = page_elem.find(f'.//{MEDIAWIKI_NS}id')
    text_elem = page_elem.find(f'.//{MEDIAWIKI_NS}text')
    
    return {
        'ns': ns_elem.text if ns_elem is not None else None,
        'title': title_elem.text if title_elem is not None else None,
        'id': id_elem.text if id_elem is not None else None,
        'text': text_elem.text if text_elem is not None else None
    }


def get_namespace_name(ns_id: str, title: str, namespace_map: Dict[str, str]) -> str:
    """
    Get the namespace name for a page.
    
    Args:
        ns_id: Namespace ID from XML
        title: Page title
        namespace_map: Namespace mapping from parse_namespaces()
        
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