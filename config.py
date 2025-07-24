"""
Configuration loader for multi-site Googology Wiki analysis tools.

This file loads the appropriate site-specific configuration based on the
current site selection, now using YAML configuration files.
"""

from pathlib import Path
from lib.config_loader import get_site_config

# Current site configuration (change this to switch sites)
#CURRENT_SITE = 'ja-googology-wiki'
CURRENT_SITE = 'googology-wiki'

# Load site-specific configuration from YAML
PROJECT_ROOT = Path(__file__).parent.resolve()
site_config = get_site_config(CURRENT_SITE)

# Export site-specific values for backward compatibility
SITE_NAME = site_config.SITE_NAME
SITE_URL = site_config.SITE_URL
SITE_BASE_URL = site_config.SITE_BASE_URL
ARCHIVE_URL = site_config.ARCHIVE_URL
LICENSE_NAME = site_config.LICENSE_NAME
LICENSE_URL = site_config.LICENSE_URL
LICENSE_SHORT = site_config.LICENSE_SHORT
MEDIAWIKI_NS = site_config.MEDIAWIKI_NS
EXCLUDED_NAMESPACES = site_config.EXCLUDED_NAMESPACES
EXCLUDED_USERNAMES = site_config.EXCLUDED_USERNAMES

# Site-specific paths (calculated in root config)
DATA_DIR = PROJECT_ROOT / 'data' / CURRENT_SITE
FETCH_LOG_FILE = str(DATA_DIR / 'fetch_log.txt')
EXCLUDE_FILE = str(DATA_DIR / 'exclude.md')

# Progress reporting interval (shared)
PROGRESS_INTERVAL = 10000
