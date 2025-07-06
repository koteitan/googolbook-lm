"""
Configuration for Googology Wiki analysis tools.

This file contains both site-specific settings and generic MediaWiki constants.
"""

# Site information
SITE_NAME = 'Googology Wiki'
SITE_URL = 'googology.fandom.com'
SITE_BASE_URL = 'https://googology.fandom.com'

# File paths (relative to project root)
XML_FILE = 'data/googology_pages_current.xml'
FETCH_LOG_FILE = 'data/fetch_log.txt'
EXCLUDE_FILE = 'exclude.md'

# Archive source
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'

# License information
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# Progress reporting interval
PROGRESS_INTERVAL = 10000