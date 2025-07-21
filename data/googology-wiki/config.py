"""
Site-specific configuration for Googology Wiki (English).
"""

# Site information
SITE_NAME = 'Googology Wiki'
SITE_URL = 'googology.fandom.com'
SITE_BASE_URL = 'https://googology.fandom.com'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'

# License information
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# Exclusion rules (converted from exclude.md)
# Excluded namespaces (namespace prefixes to exclude from analysis)
EXCLUDED_NAMESPACES = [
    'File',
    'Template', 
    'User blog comment',
    'Category',
    'GeoJson',
    'Module',
    'Map',
    'Help',
    'Forum',
    'MediaWiki',
    'Special',
    'Template talk',
    'User talk',
    'Googology Wiki talk',
    'Category talk',
    'MediaWiki talk',
    'File talk',
    'Forum talk',
    'Module talk',
    'GeoJson talk'
]

# Excluded usernames (usernames to exclude from analysis)
EXCLUDED_USERNAMES = [
    'FANDOM',
    'Wikia'
]

# Vector store configuration
VECTOR_STORE_SAMPLE_SIZE = 20000  # Number of documents to export for web interface