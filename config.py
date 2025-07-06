"""
Configuration loader for multi-site Googology Wiki analysis tools.

This file loads the appropriate site-specific configuration based on the
current site selection.
"""

import sys
from pathlib import Path

# Current site configuration (change this to switch sites)
#CURRENT_SITE = 'googology-wiki'
CURRENT_SITE = 'ja-googology-wiki'

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
LICENSE_NAME = site_config.LICENSE_NAME
LICENSE_URL = site_config.LICENSE_URL
LICENSE_SHORT = site_config.LICENSE_SHORT
MEDIAWIKI_NS = site_config.MEDIAWIKI_NS
EXCLUDED_NAMESPACES = site_config.EXCLUDED_NAMESPACES
EXCLUDED_USERNAMES = site_config.EXCLUDED_USERNAMES

# Site-specific paths (calculated in root config)
DATA_DIR = PROJECT_ROOT / 'data' / CURRENT_SITE
FETCH_LOG_FILE = str(DATA_DIR / 'fetch_log.txt')

# Progress reporting interval (shared)
PROGRESS_INTERVAL = 10000
