"""MediaWiki XML document loading utilities."""

from typing import List, Dict
from langchain_core.documents import Document
from langchain_community.document_loaders import MWDumpLoader
import config
from ..config_loader import get_site_config
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
            
        if page_count % 1000 == 0:
            print(f"Processed {page_count:,} chunks for ID mapping...", end='\r')
    
    print(f"Built mapping for {len(title_to_id):,} pages")
    return title_to_id


def build_reverse_title_mapping(title_to_id: Dict[str, str]) -> Dict[str, str]:
    """
    Build a reverse mapping from source titles (without namespace prefix) to full titles.
    
    This helps recover the correct full title when MWDumpLoader strips namespace prefixes.
    
    Args:
        title_to_id: Dictionary mapping full titles to page IDs
        
    Returns:
        Dictionary mapping source titles to full titles
    """
    source_to_full = {}
    
    print("Building reverse title mapping...")
    for full_title in title_to_id.keys():
        # Extract source title (part after namespace prefix)
        if ':' in full_title:
            # Has namespace prefix - extract the part after ':'
            source_title = full_title.split(':', 1)[1]
        else:
            # Main namespace - source title is the same as full title
            source_title = full_title
        
        # Handle conflicts by preferring main namespace, then earliest encountered
        if source_title in source_to_full:
            existing_full = source_to_full[source_title]
            # Prefer main namespace (no ':' in title)
            if ':' not in full_title:
                source_to_full[source_title] = full_title
            elif ':' in existing_full:
                # Both have namespace - keep the first one (arbitrary but consistent)
                pass
        else:
            source_to_full[source_title] = full_title
    
    print(f"Built reverse mapping for {len(source_to_full):,} source titles")
    return source_to_full


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
    
    # Load site configuration
    import config as global_config
    site_config = get_site_config(global_config.CURRENT_SITE)
    
    if namespace_filter is None:
        # Build list of included namespaces by excluding the ones in EXCLUDED_NAMESPACES
        excluded_namespaces = set(site_config.EXCLUDED_NAMESPACES)
        
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
    
    print("Loading documents...")
    documents = loader.load()
    print(f"Loaded {len(documents)} documents before filtering")
    
    # Build title-to-page-ID mapping
    title_to_id = build_title_to_page_id_mapping(xml_path)
    
    # Build reverse mapping for source title -> full title resolution
    source_to_full_title = build_reverse_title_mapping(title_to_id)
    
    # Create reverse mapping: namespace ID -> namespace name
    id_to_name = {int(ns_id): ns_name for ns_id, ns_name in namespace_mapping.items() if ns_id.isdigit()}
    
    # Filter out excluded namespaces and enhance metadata
    excluded_prefixes = [ns + ':' for ns in site_config.EXCLUDED_NAMESPACES]
    filtered_documents = []
    
    print("Filtering documents and enhancing metadata...")
    for idx, doc in enumerate(documents):
        if idx % 1000 == 0:
            print(f"Processing document {idx:,}/{len(documents):,}...", end='\r')
        if 'source' in doc.metadata:
            source_title = doc.metadata['source']
            
            # Reconstruct full title with namespace prefix
            # MWDumpLoader strips namespace prefixes, so we use reverse mapping to find the correct full title
            if source_title in source_to_full_title:
                # Use reverse mapping to get the correct full title
                full_title = source_to_full_title[source_title]
            else:
                # Fallback: reconstruct using heuristics (legacy approach)
                full_title = source_title
                
                # User blog namespace: typically contains '/' or person names
                if ('/' in source_title and 500 in namespace_filter and 500 in id_to_name):
                    # This is likely from User blog namespace
                    full_title = f"{id_to_name[500]}:{source_title}"
            
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
                url = f'{site_config.SITE_BASE_URL}/wiki/{url_title}'
            
            doc.metadata.update({
                'title': full_title,
                'id': page_id or f'page_{full_title.replace(" ", "_")}',
                'curid': page_id,  # Add curid for XML content lookup
                'url': url,
                'namespace': 'auto'  # Auto-detected from title
            })
            
            filtered_documents.append(doc)
    
    print(f"\nFiltered to {len(filtered_documents)} documents")
    return filtered_documents