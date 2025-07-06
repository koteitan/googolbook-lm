"""
File I/O utilities for MediaWiki analysis tools.
"""

import os
import sys
from pathlib import Path

# Import site-specific config from project root
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def get_fetch_date() -> str:
    """
    Get the fetch date from the fetch log file.
    
    Returns:
        Fetch date string, or 'Unknown' if not available
    """
    try:
        with open(config.FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'


def get_latest_xml_info():
    """
    Get information about the latest downloaded XML from fetch log.
    
    Returns:
        dict: Dictionary with XML path info, or None if not found
    """
    try:
        with open(config.FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        # Parse fetch log for latest download info
        info = {}
        for line in lines:
            line = line.strip()
            if line.startswith('XML path: '):
                xml_relative_path = line.replace('XML path: ', '')
                info['xml_path'] = str(config.DATA_DIR / xml_relative_path)
            elif line.startswith('Site subdirectory: '):
                info['subdirectory'] = line.replace('Site subdirectory: ', '')
            elif line.startswith('XML file: '):
                info['xml_filename'] = line.replace('XML file: ', '')
                
        if 'xml_path' in info:
            return info
            
    except Exception:
        pass
    
    return None


def find_xml_file():
    """
    Find the XML file based on the latest fetch log, falling back to directory search.
    
    Returns:
        str: Path to the XML file if found, None otherwise
    """
    # First, try to get XML path from latest fetch log
    xml_info = get_latest_xml_info()
    if xml_info and os.path.exists(xml_info['xml_path']):
        return xml_info['xml_path']
    
    # Fallback: search in data directory and subdirectories
    data_dir = config.DATA_DIR
    
    # Check if data directory exists
    if not data_dir.exists():
        return None
    
    # First check data root directory for backward compatibility
    xml_files = list(data_dir.glob('*.xml'))
    if xml_files:
        return str(xml_files[0])
    
    # Then check subdirectories
    for subdir in data_dir.iterdir():
        if subdir.is_dir():
            xml_files = list(subdir.glob('*.xml'))
            if xml_files:
                return str(xml_files[0])
    
    return None


def get_xml_file_error_message():
    """
    Get a helpful error message when no XML file is found.
    
    Returns:
        str: Error message explaining how to obtain the XML file
    """
    data_dir = config.DATA_DIR
    
    if not data_dir.exists():
        return (
            f"Data directory '{data_dir}' does not exist. "
            f"Please run tools/fetch/fetch.py to download the XML data first."
        )
    
    return (
        f"No XML files found in '{data_dir}' or its subdirectories. "
        f"Please run tools/fetch/fetch.py to download and extract the XML file from: {config.ARCHIVE_URL}"
    )


def get_xml_file():
    """
    Get the XML file path, finding it dynamically if needed.
    
    Returns:
        str: Path to the XML file if found, None otherwise
    """
    return find_xml_file()


def check_xml_exists() -> bool:
    """
    Check if XML file exists and provide helpful error message if not.
    
    Returns:
        True if file exists, False otherwise
    """
    xml_file = get_xml_file()
    
    if not xml_file:
        print("Error: XML file not found")
        print(get_xml_file_error_message())
        return False
    
    if not os.path.exists(xml_file):
        print(f"Error: XML file not found at {xml_file}")
        print("The file may have been moved or deleted.")
        return False
    
    return True