#!/usr/bin/env python3
"""
Googology Wiki Archive Fetcher

This script downloads and extracts the Googology Wiki XML export from the
official archive location and places it in the data directory.
"""

import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
import datetime

# Configuration
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'
DATA_DIR = '../../data'
ARCHIVE_FILE = 'googology_pages_current.xml.7z'
XML_FILE = 'googology_pages_current.xml'
FETCH_LOG_FILE = 'fetch_log.txt'


def download_with_progress(url: str, filename: str) -> bool:
    """
    Download file with progress indicator.
    
    Args:
        url: URL to download from
        filename: Local filename to save to
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"Downloading {url}...")
        print(f"Saving to: {filename}")
        
        def progress_hook(block_num, block_size, total_size):
            if total_size > 0:
                downloaded = block_num * block_size
                progress = min(100.0, (downloaded / total_size) * 100)
                print(f"\rProgress: {progress:.1f}% ({downloaded:,} / {total_size:,} bytes)", end='')
            else:
                print(f"\rDownloaded: {block_num * block_size:,} bytes", end='')
        
        urllib.request.urlretrieve(url, filename, progress_hook)
        print()  # New line after progress
        return True
        
    except urllib.error.URLError as e:
        print(f"\nError downloading file: {e}")
        return False
    except Exception as e:
        print(f"\nUnexpected error during download: {e}")
        return False


def extract_7z_archive(archive_path: str, extract_to: str) -> bool:
    """
    Extract 7z archive to specified directory.
    
    Args:
        archive_path: Path to the 7z archive
        extract_to: Directory to extract to
        
    Returns:
        True if successful, False otherwise
    """
    try:
        import py7zr
        print(f"Extracting {archive_path}...")
        
        with py7zr.SevenZipFile(archive_path, mode='r') as archive:
            archive.extractall(path=extract_to)
        
        print("Extraction completed successfully")
        return True
        
    except ImportError:
        print("Error: py7zr module is required but not installed.")
        print("Please install it with: pip install py7zr")
        return False
    except Exception as e:
        if 'py7zr' in str(type(e)):
            print("Error: Invalid or corrupted 7z archive")
        else:
            print(f"Error extracting archive: {e}")
        return False


def verify_xml_file(xml_path: str) -> bool:
    """
    Verify that the extracted XML file is valid.
    
    Args:
        xml_path: Path to the XML file
        
    Returns:
        True if file exists and appears valid, False otherwise
    """
    if not os.path.exists(xml_path):
        print(f"Error: XML file not found at {xml_path}")
        return False
    
    file_size = os.path.getsize(xml_path)
    if file_size == 0:
        print("Error: XML file is empty")
        return False
    
    # Check if file starts with XML declaration or MediaWiki root element
    try:
        with open(xml_path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if not (first_line.startswith('<?xml') or first_line.startswith('<mediawiki')):
                print("Warning: File may not be a valid XML file")
                return False
    except Exception as e:
        print(f"Error reading XML file: {e}")
        return False
    
    print(f"XML file verified: {file_size:,} bytes")
    return True


def cleanup_archive(archive_path: str) -> None:
    """
    Remove the downloaded archive file.
    
    Args:
        archive_path: Path to the archive file to remove
    """
    try:
        if os.path.exists(archive_path):
            os.remove(archive_path)
            print(f"Cleaned up archive file: {archive_path}")
    except Exception as e:
        print(f"Warning: Could not remove archive file: {e}")


def save_fetch_log(data_dir: Path) -> None:
    """
    Save fetch timestamp to log file.
    
    Args:
        data_dir: Path to data directory
    """
    try:
        log_file = data_dir / FETCH_LOG_FILE
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"Archive fetched: {timestamp}\n")
            f.write(f"Source: {ARCHIVE_URL}\n")
        
        print(f"Fetch log saved: {log_file}")
        
    except Exception as e:
        print(f"Warning: Could not save fetch log: {e}")


def main():
    """Main function to fetch and extract the Googology Wiki archive."""
    
    # Setup paths
    script_dir = Path(__file__).parent
    data_dir = (script_dir / DATA_DIR).resolve()
    archive_path = data_dir / ARCHIVE_FILE
    xml_path = data_dir / XML_FILE
    
    # Create data directory if it doesn't exist
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Check if XML file already exists
    if xml_path.exists():
        print(f"XML file already exists: {xml_path}")
        response = input("Do you want to re-download? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            print("Skipping download.")
            return
    
    print("Fetching Googology Wiki XML Archive")
    print("=" * 40)
    print(f"Source: {ARCHIVE_URL}")
    print(f"Target: {xml_path}")
    print()
    
    # Download the archive
    if not download_with_progress(ARCHIVE_URL, str(archive_path)):
        print("Failed to download archive")
        sys.exit(1)
    
    print(f"Archive downloaded: {archive_path}")
    
    # Extract the archive
    if not extract_7z_archive(str(archive_path), str(data_dir)):
        print("Failed to extract archive")
        cleanup_archive(str(archive_path))
        sys.exit(1)
    
    # Verify the extracted XML file
    if not verify_xml_file(str(xml_path)):
        print("XML file verification failed")
        cleanup_archive(str(archive_path))
        sys.exit(1)
    
    # Clean up the archive file
    cleanup_archive(str(archive_path))
    
    # Save fetch log
    save_fetch_log(data_dir)
    
    print()
    print("SUCCESS: Googology Wiki XML archive has been downloaded and extracted")
    print(f"Location: {xml_path}")
    print()
    print("You can now run analysis tools that require the XML data.")


if __name__ == "__main__":
    main()