"""
Configuration for Googology Wiki analysis tools.

This file contains both site-specific settings and generic MediaWiki constants.
"""

import os
from pathlib import Path

# Get project root directory (where this config.py file is located)
PROJECT_ROOT = Path(__file__).parent.resolve()

# Site information
SITE_NAME = 'Googology Wiki'
SITE_URL = 'googology.fandom.com'
SITE_BASE_URL = 'https://googology.fandom.com'

def find_xml_file():
    """
    Find the first XML file in the data directory.
    
    Returns:
        str: Path to the XML file if found, None otherwise
    """
    data_dir = PROJECT_ROOT / 'data'
    
    # Check if data directory exists
    if not data_dir.exists():
        return None
    
    # Find all XML files in the data directory
    xml_files = list(data_dir.glob('*.xml'))
    
    if xml_files:
        # Return the first XML file found
        return str(xml_files[0])
    
    return None

# File paths (absolute paths based on project root)
XML_FILE = find_xml_file()
FETCH_LOG_FILE = str(PROJECT_ROOT / 'data' / 'fetch_log.txt')
EXCLUDE_FILE = str(PROJECT_ROOT / 'exclude.md')

# Archive source
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'

def get_xml_file_error_message():
    """
    Get a helpful error message when no XML file is found.
    
    Returns:
        str: Error message explaining how to obtain the XML file
    """
    data_dir = PROJECT_ROOT / 'data'
    
    if not data_dir.exists():
        return (
            f"Data directory '{data_dir}' does not exist. "
            f"Please create the directory and place the XML file there."
        )
    
    return (
        f"No XML files found in '{data_dir}'. "
        f"Please download and extract the XML file from: {ARCHIVE_URL}"
    )

# License information
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# Progress reporting interval
PROGRESS_INTERVAL = 10000