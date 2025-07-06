"""
Configuration for Googology Wiki analysis tools.

This file contains site-specific settings and generic MediaWiki constants.
Constants only - no functions.
"""

from pathlib import Path

# Site information
## Googology Wiki
SITE_NAME = 'Googology Wiki'
SITE_URL = 'googology.fandom.com'
SITE_BASE_URL = 'https://googology.fandom.com'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'

"""
## Japanese Googology Wiki
SITE_NAME = '巨大数研究 Wiki'
SITE_URL = 'googology.fandom.com/ja'
SITE_BASE_URL = 'https://googology.fandom.com/ja'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/j/ja/jagoogology_pages_current.xml.7z'
"""

# License information
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# File paths
PROJECT_ROOT = Path(__file__).parent.resolve()
DATA_DIR = PROJECT_ROOT / 'data'
FETCH_LOG_FILE = str(PROJECT_ROOT / 'data' / 'fetch_log.txt')
EXCLUDE_FILE = str(PROJECT_ROOT / 'exclude.md')

# Progress reporting interval
PROGRESS_INTERVAL = 10000
