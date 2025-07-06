"""
Site-specific configuration for Googology Wiki (English).
"""

from pathlib import Path

# Site information
SITE_NAME = 'Googology Wiki'
SITE_URL = 'googology.fandom.com'
SITE_BASE_URL = 'https://googology.fandom.com'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'

# Site-specific paths
SITE_CONFIG_DIR = Path(__file__).parent
DATA_DIR = SITE_CONFIG_DIR
FETCH_LOG_FILE = str(DATA_DIR / 'fetch_log.txt')