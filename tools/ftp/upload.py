#!/usr/bin/env python3
"""
FTP upload script for uploading gzip files to FTP server.
Reads configuration from ftp.yml file.
"""

import argparse
import ftplib
import os
import sys
import yaml
from pathlib import Path
from typing import List, Optional, Dict


def load_config(config_path: str = "ftp.yml") -> dict:
    """Load FTP configuration from YAML file."""
    # Support running from root directory
    if not os.path.exists(config_path) and config_path == "ftp.yml":
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(script_dir, "ftp.yml")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Validate required fields
        required_fields = ['host', 'username', 'password', 'destinations']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field: {field}")
        
        # Set default port if not specified
        if 'port' not in config:
            config['port'] = 21
            
        return config
    except FileNotFoundError:
        print(f"Error: Configuration file '{config_path}' not found.")
        print("Please create 'ftp.yml' from 'ftp.yml.example' template.")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"Error parsing YAML configuration: {e}")
        sys.exit(1)
    except ValueError as e:
        print(f"Configuration error: {e}")
        sys.exit(1)


def get_site_config(config: dict, sitename: str) -> Dict[str, str]:
    """Get configuration for a specific site."""
    destinations = config.get('destinations', [])
    
    # Determine data directory path based on current working directory
    if os.path.basename(os.getcwd()) == "ftp":
        data_dir = f"../../data/{sitename}"
    else:
        data_dir = f"data/{sitename}"
    
    for dest in destinations:
        site = dest.get('site')
        if site and site.get('sitename') == sitename:
            return {
                'sitename': sitename,
                'dir': site.get('dir'),
                'data_dir': data_dir
            }
    
    # Site not found
    available_sites = []
    for d in destinations:
        site = d.get('site')
        if site and site.get('sitename'):
            available_sites.append(site.get('sitename'))
    
    print(f"Error: Site '{sitename}' not found in configuration.")
    if available_sites:
        print(f"Available sites: {', '.join(available_sites)}")
    sys.exit(1)


def get_all_sites(config: dict) -> List[str]:
    """Get list of all available site names."""
    destinations = config.get('destinations', [])
    sites = []
    
    for dest in destinations:
        site = dest.get('site')
        if site and site.get('sitename'):
            sites.append(site.get('sitename'))
    
    return sites


def upload_site(config: dict, sitename: str):
    """Upload files for a specific site."""
    # Get site-specific configuration
    site_config = get_site_config(config, sitename)
    
    # Get files to upload from site's data directory
    gz_files = get_gz_files(site_config['data_dir'])
    
    if not gz_files:
        print(f"No .gz files found in '{site_config['data_dir']}'")
        return False
    
    print(f"Site: {sitename}")
    print(f"Found {len(gz_files)} file(s) to upload:")
    for f in gz_files:
        print(f"  - {f.name} ({f.stat().st_size:,} bytes)")
    print()
    
    # Connect to FTP server
    print(f"Connecting to {config['host']}:{config['port']}...")
    
    try:
        ftp = ftplib.FTP()
        ftp.connect(config['host'], config['port'])
        ftp.login(config['username'], config['password'])
        
        print(f"Connected successfully")
        print(f"Remote directory: {site_config['dir']}")
        print()
        
        # Ensure remote directory exists
        ensure_remote_directory(ftp, site_config['dir'], verbose=True)
        
        # Upload files
        success_count = 0
        for file_path in gz_files:
            try:
                upload_file(ftp, file_path, site_config['dir'], verbose=True)
                success_count += 1
            except Exception as e:
                print(f"Error uploading {file_path.name}: {e}")
                continue
        
        ftp.quit()
        
        print(f"Upload completed for {sitename}: {success_count}/{len(gz_files)} file(s)")
        print("-" * 50)
        return True
        
    except ftplib.error_perm as e:
        print(f"FTP permission error for {sitename}: {e}")
        return False
    except ftplib.error_temp as e:
        print(f"FTP temporary error for {sitename}: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error for {sitename}: {e}")
        return False


def get_gz_files(directory: str) -> List[Path]:
    """Get list of .gz files in the specified directory."""
    dir_path = Path(directory)
    if not dir_path.exists():
        print(f"Error: Directory '{directory}' does not exist.")
        sys.exit(1)
    
    gz_files = list(dir_path.glob("*.gz"))
    
    return sorted(gz_files)


def upload_file(ftp: ftplib.FTP, local_file: Path, remote_path: str, verbose: bool = True):
    """Upload a single file to FTP server."""
    remote_file = os.path.join(remote_path, local_file.name)
    file_size = local_file.stat().st_size
    
    if verbose:
        print(f"Uploading: {local_file.name} ({file_size:,} bytes) -> {remote_file}")
    
    with open(local_file, 'rb') as f:
        ftp.storbinary(f'STOR {remote_file}', f)
    
    if verbose:
        print(f"  ✓ Uploaded successfully")


def ensure_remote_directory(ftp: ftplib.FTP, directory: str, verbose: bool = False):
    """Ensure remote directory exists, create if necessary."""
    parts = directory.strip('/').split('/')
    current_dir = ''
    
    for part in parts:
        current_dir = f"{current_dir}/{part}"
        try:
            ftp.cwd(current_dir)
        except ftplib.error_perm:
            # Directory doesn't exist, try to create it
            try:
                ftp.mkd(current_dir)
                if verbose:
                    print(f"Created directory: {current_dir}")
            except ftplib.error_perm as e:
                print(f"Error: Cannot create directory '{current_dir}': {e}")
                raise


def main():
    parser = argparse.ArgumentParser(
        description="Upload gzip files to FTP server for a specific site",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Upload all sites defined in configuration
  python upload.py

  # Upload Japanese Googology Wiki files only
  python upload.py ja-googology-wiki

  # Upload English Googology Wiki files only
  python upload.py googology-wiki

  # Use custom configuration file
  python upload.py --config my_ftp_config.yml
        """
    )
    
    parser.add_argument(
        'sitename',
        nargs='?',
        help='Site name to upload (e.g., ja-googology-wiki, googology-wiki). If not specified, uploads all sites.'
    )
    parser.add_argument(
        '--config', '-c',
        default='ftp.yml',
        help='FTP configuration file (default: ftp.yml)'
    )
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    
    if args.sitename:
        # Upload specific site
        success = upload_site(config, args.sitename)
        if not success:
            sys.exit(1)
    else:
        # Upload all sites
        all_sites = get_all_sites(config)
        if not all_sites:
            print("No sites found in configuration.")
            sys.exit(1)
        
        print(f"Uploading all sites: {', '.join(all_sites)}")
        print("=" * 50)
        
        success_count = 0
        for site in all_sites:
            if upload_site(config, site):
                success_count += 1
        
        print(f"\nOverall upload completed: {success_count}/{len(all_sites)} site(s) successful")
        
        if success_count < len(all_sites):
            sys.exit(1)


if __name__ == '__main__':
    main()