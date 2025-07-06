"""
Site-specific configuration for 巨大数研究 Wiki (Japanese).
"""

from pathlib import Path

# Site information
SITE_NAME = '巨大数研究 Wiki'
SITE_URL = 'ja.googology.fandom.com'
SITE_BASE_URL = 'https://ja.googology.fandom.com'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/j/ja/jagoogology_pages_current.xml.7z'

# Site-specific paths
SITE_CONFIG_DIR = Path(__file__).parent
DATA_DIR = SITE_CONFIG_DIR
FETCH_LOG_FILE = str(DATA_DIR / 'fetch_log.txt')