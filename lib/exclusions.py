"""
Exclusion handling utilities for Googology Wiki analysis tools.
"""

from typing import List, Tuple, Dict
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def load_excluded_namespaces(exclude_file_path: str = None) -> List[str]:
    """
    Load excluded namespaces from site configuration.
    
    Args:
        exclude_file_path: DEPRECATED - kept for compatibility, ignored
        
    Returns:
        List of excluded namespace prefixes from site configuration
    """
    return config.EXCLUDED_NAMESPACES


def load_excluded_usernames(exclude_file_path: str = None) -> List[str]:
    """
    Load excluded usernames from site configuration.
    
    Args:
        exclude_file_path: DEPRECATED - kept for compatibility, ignored
        
    Returns:
        List of excluded usernames from site configuration
    """
    return config.EXCLUDED_USERNAMES


def load_exclusions(exclude_file_path: str = None) -> Tuple[List[str], List[str]]:
    """
    Load both excluded namespaces and usernames from site configuration.
    
    Args:
        exclude_file_path: DEPRECATED - kept for compatibility, ignored
        
    Returns:
        Tuple of (excluded_namespaces, excluded_usernames)
    """
    return (
        load_excluded_namespaces(),
        load_excluded_usernames()
    )


def create_namespace_string_to_id_map(namespace_map: Dict[str, str]) -> Dict[str, str]:
    """
    Create a mapping from namespace strings to IDs based on XML namespace definitions.
    
    Args:
        namespace_map: Dictionary mapping namespace IDs to names from XML
        
    Returns:
        Dictionary mapping namespace strings to IDs
    """
    string_to_id = {}
    
    # Create reverse mapping from parsed XML namespace definitions
    for ns_id, ns_name in namespace_map.items():
        string_to_id[ns_name] = ns_id
        
    # Add common string variations that might appear in exclude.md
    string_variations = {
        'File': '6',
        'Template': '10', 
        'User blog comment': '501',
        'Category': '14',
        'GeoJson': '420',
        'Module': '828',
        'Map': '420',  # Map namespace might be same as GeoJson
        'Help': '12',
        'Forum': '110',
        'MediaWiki': '8',
        'Special': '-1',
        'Template talk': '11',
        'User talk': '3',
        'Googology Wiki talk': '5',
        'Category talk': '15',
        'MediaWiki talk': '9',
        'File talk': '7',
        'Forum talk': '111',
        'Module talk': '829',
        'GeoJson talk': '421',
        'User blog': '500',
        'User': '2',
        'Talk': '1',
        'Main': '0',
        'Blog': '500',  # Alternative name for User blog
        'Googology Wiki': '4'
    }
    
    # Add variations, but don't override XML-parsed definitions
    for string_name, ns_id in string_variations.items():
        if string_name not in string_to_id:
            string_to_id[string_name] = ns_id
            
    return string_to_id


def should_exclude_page_by_namespace_id(ns_id: str, excluded_namespace_ids: List[str]) -> bool:
    """
    Check if a page should be excluded based on its namespace ID.
    
    Args:
        ns_id: Namespace ID (e.g., "0", "2", "500")
        excluded_namespace_ids: List of excluded namespace IDs
        
    Returns:
        True if page should be excluded
    """
    return ns_id in excluded_namespace_ids


def convert_excluded_namespaces_to_ids(excluded_namespaces: List[str], namespace_map: Dict[str, str]) -> List[str]:
    """
    Convert excluded namespace strings to namespace IDs.
    
    Args:
        excluded_namespaces: List of excluded namespace strings from exclude.md
        namespace_map: Dictionary mapping namespace IDs to names from XML
        
    Returns:
        List of excluded namespace IDs
    """
    string_to_id = create_namespace_string_to_id_map(namespace_map)
    excluded_ids = []
    
    for namespace_string in excluded_namespaces:
        if namespace_string in string_to_id:
            excluded_ids.append(string_to_id[namespace_string])
        else:
            print(f"Warning: Unknown namespace '{namespace_string}' in site configuration")
            
    return excluded_ids


def should_exclude_page(title: str, excluded_namespaces: List[str]) -> bool:
    """
    Check if a page should be excluded based on its title namespace.
    
    DEPRECATED: Use should_exclude_page_by_namespace_id() with namespace ID instead.
    This function is kept for backward compatibility.
    
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


def should_exclude_contributor(contributor_name: str, excluded_usernames: List[str]) -> bool:
    """
    Check if a contributor should be excluded based on username.
    
    Args:
        contributor_name: Contributor username
        excluded_usernames: List of excluded usernames
        
    Returns:
        True if contributor should be excluded
    """
    return contributor_name in excluded_usernames