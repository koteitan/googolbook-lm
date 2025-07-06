# fetch

Downloads and extracts MediaWiki XML export archives from various sources.

## Overview

Automatically downloads MediaWiki XML exports from archives and extracts them to the data directory. Supports various sources including Wikia/Fandom servers.

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

The script creates files in the `data/` directory:

- `*.xml` - Complete MediaWiki XML export (size varies by wiki)
- `fetch_log.txt` - Download timestamp and source URL

## License

[Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).
