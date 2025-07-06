# fetch

Downloads and extracts the official Googology Wiki XML export archive.

## Overview

Automatically downloads the complete MediaWiki XML export from the official archive and extracts it to the data directory.

## Usage

```bash
cd tools/fetch
pip install py7zr
python3 fetch.py
```

## Requirements

- Python 3.x
- `py7zr` library for 7z extraction

## Output

The script creates two files in the `data/` directory:

- `googology_pages_current.xml` - Complete MediaWiki XML export (~210MB)
- `fetch_log.txt` - Download timestamp and source URL

## License

[Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).
