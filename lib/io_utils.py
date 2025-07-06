"""
File I/O utilities for Googology Wiki analysis tools.
"""

import os
from .config import FETCH_LOG_FILE


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


def check_xml_exists(xml_file_path: str) -> bool:
    """
    Check if XML file exists and provide helpful error message if not.
    
    Args:
        xml_file_path: Path to the MediaWiki XML export file
        
    Returns:
        True if file exists, False otherwise
    """
    if not os.path.exists(xml_file_path):
        print(f"Error: XML file not found at {xml_file_path}")
        print("Please run the fetch tool first to download the data.")
        return False
    return True