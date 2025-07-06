"""
XML parsing utilities for MediaWiki exports.
"""

import xml.etree.ElementTree as ET
from typing import Dict, Generator, Optional, Tuple
from .config import MEDIAWIKI_NS, PROGRESS_INTERVAL


def parse_namespaces(xml_file_path: str) -> Dict[str, str]:
    """
    Parse namespace definitions from MediaWiki XML file.
    
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


def extract_page_elements(page_elem) -> Dict[str, Optional[str]]:
    """
    Extract common elements from a page XML element.
    
    Args:
        page_elem: XML element representing a page
        
    Returns:
        Dictionary with extracted elements (id, title, ns, text, etc.)
    """
    elements = {}
    
    # Extract basic page information
    elements['id'] = None
    id_elem = page_elem.find(f'.//{MEDIAWIKI_NS}id')
    if id_elem is not None:
        elements['id'] = id_elem.text
    
    elements['title'] = None
    title_elem = page_elem.find(f'.//{MEDIAWIKI_NS}title')
    if title_elem is not None:
        elements['title'] = title_elem.text
    
    elements['ns'] = None
    ns_elem = page_elem.find(f'.//{MEDIAWIKI_NS}ns')
    if ns_elem is not None:
        elements['ns'] = ns_elem.text
    
    # Extract latest revision text
    elements['text'] = None
    text_elem = page_elem.find(f'.//{MEDIAWIKI_NS}text')
    if text_elem is not None:
        elements['text'] = text_elem.text
    
    # Extract revision information
    elements['contributor'] = None
    elements['contributor_id'] = None
    
    revision_elem = page_elem.find(f'.//{MEDIAWIKI_NS}revision')
    if revision_elem is not None:
        contributor_elem = revision_elem.find(f'.//{MEDIAWIKI_NS}contributor')
        if contributor_elem is not None:
            username_elem = contributor_elem.find(f'.//{MEDIAWIKI_NS}username')
            if username_elem is not None:
                elements['contributor'] = username_elem.text
            
            id_elem = contributor_elem.find(f'.//{MEDIAWIKI_NS}id')
            if id_elem is not None:
                elements['contributor_id'] = id_elem.text
            
            # Handle IP contributors
            ip_elem = contributor_elem.find(f'.//{MEDIAWIKI_NS}ip')
            if ip_elem is not None:
                elements['contributor'] = ip_elem.text
    
    return elements


def iterate_pages(xml_file_path: str, show_progress: bool = True) -> Generator[Tuple[int, Dict[str, Optional[str]]], None, None]:
    """
    Iterator over pages in MediaWiki XML file with progress reporting.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        show_progress: Whether to show progress messages
        
    Yields:
        Tuple of (page_count, extracted_elements_dict)
    """
    page_count = 0
    
    for event, elem in ET.iterparse(xml_file_path, events=('start', 'end')):
        if event == 'end' and elem.tag.endswith('}page'):
            page_count += 1
            
            if show_progress and page_count % PROGRESS_INTERVAL == 0:
                print(f"Processed {page_count:,} pages...")
            
            # Extract page elements
            elements = extract_page_elements(elem)
            
            yield page_count, elements
            
            # Clear element to save memory
            elem.clear()