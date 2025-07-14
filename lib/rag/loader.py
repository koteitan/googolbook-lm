"""MediaWiki XML document loading utilities."""

from typing import List, Dict
from langchain_core.documents import Document
from langchain_community.document_loaders import MWDumpLoader
import config
from ..xml_parser import parse_namespaces, iterate_pages


def build_title_to_page_id_mapping(xml_path: str) -> Dict[str, str]:
    """
    Build a mapping from page titles to page IDs by parsing XML directly.
    
    Args:
        xml_path: Path to the MediaWiki XML dump file
        
    Returns:
        Dictionary mapping page titles to page IDs
    """
    title_to_id = {}
    
    print("Building title-to-page-ID mapping...")
    for page_count, elements in iterate_pages(xml_path, show_progress=False):
        if elements.get('id') and elements.get('title'):
            title_to_id[elements['title']] = elements['id']
            
        if page_count % 10000 == 0:
            print(f"Processed {page_count:,} pages for ID mapping...")
    
    print(f"Built mapping for {len(title_to_id):,} pages")
    return title_to_id


def load_mediawiki_documents(xml_path: str, namespace_filter: List[int] = None) -> List[Document]:
    """
    Load documents from MediaWiki XML dump file.
    
    Args:
        xml_path: Path to the MediaWiki XML dump file
        namespace_filter: List of namespace IDs to include (default: None = all except excluded)
        
    Returns:
        List of Document objects with page content and metadata
    """
    # Parse namespaces from XML file
    namespace_mapping = parse_namespaces(xml_path)
    print(f"Parsed {len(namespace_mapping)} namespaces from XML")
    
    if namespace_filter is None:
        # Build list of included namespaces by excluding the ones in EXCLUDED_NAMESPACES
        excluded_namespaces = set(config.EXCLUDED_NAMESPACES)
        
        # Get all namespace IDs that don't match excluded namespace names
        included_ns_ids = []
        for ns_id, ns_name in namespace_mapping.items():
            try:
                ns_id_int = int(ns_id)
                # Skip negative namespace IDs (Media, Special) - MWDumpLoader has issues with them
                if ns_id_int < 0:
                    continue
                # Include if namespace name is not in excluded list
                if ns_name not in excluded_namespaces:
                    included_ns_ids.append(ns_id_int)
            except ValueError:
                continue  # Skip non-numeric namespace IDs
        
        namespace_filter = included_ns_ids
        print(f"Including namespaces: {sorted(namespace_filter)}")
        print(f"Excluded namespaces: {excluded_namespaces}")
        
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=namespace_filter,
        skip_redirects=False  # Include redirects
    )
    
    documents = loader.load()
    print(f"Loaded {len(documents)} documents before filtering")
    
    # Build title-to-page-ID mapping
    title_to_id = build_title_to_page_id_mapping(xml_path)
    
    # Create reverse mapping: namespace ID -> namespace name
    id_to_name = {int(ns_id): ns_name for ns_id, ns_name in namespace_mapping.items() if ns_id.isdigit()}
    
    # Filter out excluded namespaces and enhance metadata
    excluded_prefixes = [ns + ':' for ns in config.EXCLUDED_NAMESPACES]
    filtered_documents = []
    
    for doc in documents:
        if 'source' in doc.metadata:
            source_title = doc.metadata['source']
            
            # Reconstruct full title with namespace prefix
            # MWDumpLoader strips namespace prefixes, so we need to add them back
            full_title = source_title
            
            # Reconstruct namespace prefix based on title patterns
            # MWDumpLoader strips namespace prefixes, so we need to detect and restore them
            
            # User blog namespace: typically contains '/' or person names
            if ('/' in source_title and 500 in namespace_filter and 500 in id_to_name):
                # This is likely from User blog namespace
                full_title = f"{id_to_name[500]}:{source_title}"
            else:
                # Main namespace or other - no prefix needed for Main
                full_title = source_title
            
            # Skip if title starts with excluded namespace prefix
            if any(full_title.startswith(prefix) for prefix in excluded_prefixes):
                continue
                
            # Enhance metadata
            # Generate curid-based URL
            page_id = title_to_id.get(full_title)
            if page_id:
                url = f'https://googology.fandom.com/wiki/?curid={page_id}'
            else:
                # Fallback to wiki URL if page ID not found
                url_title = full_title.replace(" ", "_")
                url = f'{config.SITE_BASE_URL}/wiki/{url_title}'
            
            doc.metadata.update({
                'title': full_title,
                'id': page_id or f'page_{full_title.replace(" ", "_")}',
                'url': url,
                'namespace': 'auto'  # Auto-detected from title
            })
            
            filtered_documents.append(doc)
    
    print(f"Filtered to {len(filtered_documents)} documents")
    return filtered_documents