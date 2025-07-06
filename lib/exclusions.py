"""
Exclusion handling utilities for Googology Wiki analysis tools.
"""

from typing import List, Tuple
from .config import EXCLUDE_FILE


def load_excluded_namespaces(exclude_file_path: str = None) -> List[str]:
    """
    Load excluded namespaces from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file (defaults to config value)
        
    Returns:
        List of excluded namespace prefixes
    """
    if exclude_file_path is None:
        exclude_file_path = EXCLUDE_FILE
        
    excluded_namespaces = []
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- `') and line.endswith(':`'):
                    # Extract namespace from lines like "- `User talk:`"
                    namespace = line[3:-2]  # Remove "- `" and "`:"
                    excluded_namespaces.append(namespace)
    except Exception as e:
        print(f"Warning: Could not load exclusions from {exclude_file_path}: {e}")
    return excluded_namespaces


def load_excluded_usernames(exclude_file_path: str = None) -> List[str]:
    """
    Load excluded usernames from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file (defaults to config value)
        
    Returns:
        List of excluded usernames
    """
    if exclude_file_path is None:
        exclude_file_path = EXCLUDE_FILE
        
    excluded_usernames = []
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- `') and line.endswith('`'):
                    content = line[3:-1]  # Remove "- `" and "`"
                    if '<username>' in content and '</username>' in content:
                        # Extract username from lines like "- `<username>FANDOM</username>`"
                        start = content.find('<username>') + len('<username>')
                        end = content.find('</username>')
                        if start > len('<username>') - 1 and end > start:
                            username = content[start:end]
                            excluded_usernames.append(username)
    except Exception as e:
        print(f"Warning: Could not load username exclusions from {exclude_file_path}: {e}")
    return excluded_usernames


def load_exclusions(exclude_file_path: str = None) -> Tuple[List[str], List[str]]:
    """
    Load both excluded namespaces and usernames from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file (defaults to config value)
        
    Returns:
        Tuple of (excluded_namespaces, excluded_usernames)
    """
    return (
        load_excluded_namespaces(exclude_file_path),
        load_excluded_usernames(exclude_file_path)
    )


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