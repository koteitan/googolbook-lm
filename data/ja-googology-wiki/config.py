"""
Site-specific configuration for 巨大数研究 Wiki (Japanese).
"""

# Site information
SITE_NAME = '巨大数研究 Wiki'
SITE_URL = 'googology.fandom.com/ja'
SITE_BASE_URL = 'https://googology.fandom.com/ja'
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/j/ja/jagoogology_pages_current.xml.7z'

# License information
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# Exclusion rules (converted from exclude.md)
# Excluded namespaces (namespace prefixes to exclude from analysis)
EXCLUDED_NAMESPACES = [
    'ファイル',  # File
    'テンプレート',  # Template
    'ユーザーブログ・コメント',  # User blog comment
    'カテゴリ',  # Category
    'GeoJson',
    'モジュール',  # Module
    'Map',
    'ヘルプ',  # Help
    'フォーラム',  # Forum
    'MediaWiki',
    'Special',
    'テンプレート・トーク',  # Template talk
    'ユーザー・トーク',  # User talk
    '巨大数研究 Wiki・トーク',  # Googology Wiki talk
    'カテゴリ・トーク',  # Category talk
    'MediaWiki・トーク',  # MediaWiki talk
    'ファイル・トーク',  # File talk
    'フォーラム・トーク',  # Forum talk
    'モジュール・トーク',  # Module talk
    'GeoJson talk'  # GeoJson talk
]

# Excluded usernames (usernames to exclude from analysis)
EXCLUDED_USERNAMES = [
    'FANDOM',
    'Wikia'
]
