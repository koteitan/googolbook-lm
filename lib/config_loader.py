"""YAML configuration loader for site-specific settings."""

import yaml
from pathlib import Path


class SiteConfig:
    """Site-specific configuration loaded from YAML file."""
    
    def __init__(self, site_name=None):
        if site_name is None:
            # Avoid circular import by setting default directly
            site_name = 'googology-wiki'
        
        self.site_name = site_name
        # Build path directly to avoid circular import
        from pathlib import Path
        PROJECT_ROOT = Path(__file__).parent.parent.resolve()
        self.config_path = PROJECT_ROOT / 'data' / site_name / 'config.yml'
        self._config = self._load_config()
    
    def _load_config(self):
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @property
    def SITE_NAME(self):
        return self._config['site']['name']
    
    @property
    def SITE_URL(self):
        return self._config['site']['url']
    
    @property
    def SITE_BASE_URL(self):
        return self._config['site']['base_url']
    
    @property
    def ARCHIVE_URL(self):
        return self._config['site']['archive_url']
    
    @property
    def LICENSE_NAME(self):
        return self._config['license']['name']
    
    @property
    def LICENSE_URL(self):
        return self._config['license']['url']
    
    @property
    def LICENSE_SHORT(self):
        return self._config['license']['short']
    
    @property
    def MEDIAWIKI_NS(self):
        return self._config['mediawiki']['namespace_uri']
    
    @property
    def EXCLUDED_NAMESPACES(self):
        return self._config['exclusions']['namespaces']
    
    @property
    def EXCLUDED_USERNAMES(self):
        return self._config['exclusions']['usernames']
    
    @property
    def VECTOR_STORE_SAMPLE_SIZE(self):
        return self._config['vector_store']['sample_size']
    
    @property
    def DOCUMENTS_PER_PART(self):
        return self._config['vector_store']['chunks_per_part']
    
    @property
    def PRELIMINARY_DOCS_PER_PART(self):
        return self._config['vector_store']['preliminary_per_part']
    
    @property
    def FINAL_RESULT_COUNT(self):
        return self._config['vector_store']['final_result_count']


# Global site configuration cache
_site_configs = {}

def get_site_config(site_name=None):
    """Get the site configuration instance (cached per site)."""
    if site_name is None:
        site_name = 'googology-wiki'
    
    global _site_configs
    if site_name not in _site_configs:
        _site_configs[site_name] = SiteConfig(site_name)
    return _site_configs[site_name]


# Backward compatibility: provide module-level attributes
def __getattr__(name):
    """Provide backward compatibility for direct attribute access."""
    site_config = get_site_config()
    if hasattr(site_config, name):
        return getattr(site_config, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")