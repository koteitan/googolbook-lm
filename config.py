"""
Configuration loader for multi-site Googology Wiki analysis tools.

This file loads the appropriate site-specific configuration based on the
current site selection.
"""

import sys
from pathlib import Path

# Current site configuration (change this to switch sites)
CURRENT_SITE = 'googology-wiki'  # Options: 'googology-wiki', 'ja-googology-wiki'

# Load site-specific configuration
PROJECT_ROOT = Path(__file__).parent.resolve()
site_config_path = PROJECT_ROOT / 'data' / CURRENT_SITE / 'config.py'

if not site_config_path.exists():
    raise FileNotFoundError(f"Site configuration not found: {site_config_path}")

# Import site-specific config
sys.path.insert(0, str(site_config_path.parent))
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location("site_config", site_config_path)
    site_config = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(site_config)
except ImportError:
    # Fallback method
    import imp
    site_config = imp.load_source('site_config', str(site_config_path))

# Export site-specific values
SITE_NAME = site_config.SITE_NAME
SITE_URL = site_config.SITE_URL
SITE_BASE_URL = site_config.SITE_BASE_URL
ARCHIVE_URL = site_config.ARCHIVE_URL
DATA_DIR = site_config.DATA_DIR
FETCH_LOG_FILE = site_config.FETCH_LOG_FILE

# License information (shared across all sites)
LICENSE_NAME = 'Creative Commons Attribution-ShareAlike 3.0 Unported License'
LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/'
LICENSE_SHORT = 'CC BY-SA 3.0'

# MediaWiki XML namespace URI (shared)
MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'

# Global paths
EXCLUDE_FILE = str(PROJECT_ROOT / 'exclude.md')

# Progress reporting interval (shared)
PROGRESS_INTERVAL = 10000
