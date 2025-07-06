"""
Formatting utilities for Googology Wiki analysis tools.
"""

import urllib.parse


def format_number(num: int) -> str:
    """
    Format number with commas for readability.
    
    Args:
        num: Number to format
        
    Returns:
        Formatted string with commas
    """
    return f"{num:,}"


def format_bytes(bytes_count: int) -> str:
    """
    Format byte count in human-readable format.
    
    Args:
        bytes_count: Number of bytes
        
    Returns:
        Formatted string with appropriate unit (B, KB, MB, GB, TB)
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} TB"


def generate_wiki_url(title: str) -> str:
    """
    Generate a Googology Wiki URL from a page title.
    
    Args:
        title: Page title
        
    Returns:
        Complete wiki URL
    """
    encoded_title = urllib.parse.quote(title.replace(' ', '_'))
    return f"https://googology.fandom.com/wiki/{encoded_title}"


def generate_curid_url(page_id: str) -> str:
    """
    Generate a Googology Wiki URL using page ID (curid).
    
    Args:
        page_id: Page ID
        
    Returns:
        Complete wiki URL with curid parameter
    """
    return f"https://googology.fandom.com/?curid={page_id}"