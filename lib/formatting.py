"""
Formatting utilities for MediaWiki analysis tools.
"""

import urllib.parse
import sys
from pathlib import Path

# Import site-specific config from project root
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


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
    Generate a wiki URL from a page title.
    
    Args:
        title: Page title
        
    Returns:
        Complete wiki URL
    """
    encoded_title = urllib.parse.quote(title.replace(' ', '_'))
    return f"{config.SITE_BASE_URL}/wiki/{encoded_title}"


def generate_curid_url(page_id: str) -> str:
    """
    Generate a wiki URL using page ID (curid).
    
    Args:
        page_id: Page ID
        
    Returns:
        Complete wiki URL with curid parameter
    """
    return f"{config.SITE_BASE_URL}/?curid={page_id}"