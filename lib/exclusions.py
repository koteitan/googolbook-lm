"""
Exclusion handling utilities for filtering content.
"""

from typing import List, Tuple


def load_excluded_namespaces(exclude_file_path: str) -> List[str]:
    """
    Load excluded namespaces from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file
        
    Returns:
        List of excluded namespace names
    """
    excluded_namespaces = []
    
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- `') and line.endswith(':`'):
                    namespace = line[3:-2]  # Remove "- `" and "`:"
                    excluded_namespaces.append(namespace)
    except Exception as e:
        print(f"Warning: Could not load exclusions from {exclude_file_path}: {e}")
        
    return excluded_namespaces


def load_excluded_usernames(exclude_file_path: str) -> List[str]:
    """
    Load excluded usernames from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file
        
    Returns:
        List of excluded usernames
    """
    excluded_usernames = []
    in_users_section = False
    
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line == '## Users':
                    in_users_section = True
                    continue
                elif line.startswith('## ') and in_users_section:
                    break  # End of users section
                elif in_users_section and line.startswith('- `') and line.endswith('`'):
                    username = line[3:-1]  # Remove "- `" and "`"
                    excluded_usernames.append(username)
    except Exception as e:
        print(f"Warning: Could not load user exclusions from {exclude_file_path}: {e}")
        
    return excluded_usernames


def load_exclusions(exclude_file_path: str) -> Tuple[List[str], List[str]]:
    """
    Load both namespace and username exclusions from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file
        
    Returns:
        Tuple of (excluded_namespaces, excluded_usernames)
    """
    excluded_namespaces = load_excluded_namespaces(exclude_file_path)
    excluded_usernames = load_excluded_usernames(exclude_file_path)
    return excluded_namespaces, excluded_usernames


def should_exclude_page(title: str, excluded_namespaces: List[str]) -> bool:
    """
    Check if a page should be excluded based on its namespace.
    
    Args:
        title: Page title
        excluded_namespaces: List of excluded namespace names
        
    Returns:
        True if page should be excluded, False otherwise
    """
    if ':' in title:
        namespace = title.split(':', 1)[0]
        namespace_normalized = namespace.replace('_', ' ')
        return namespace in excluded_namespaces or namespace_normalized in excluded_namespaces
    return False


def should_exclude_contributor(contributor_name: str, excluded_usernames: List[str]) -> bool:
    """
    Check if a contributor should be excluded.
    
    Args:
        contributor_name: Username or IP address
        excluded_usernames: List of excluded usernames
        
    Returns:
        True if contributor should be excluded, False otherwise
    """
    return contributor_name in excluded_usernames