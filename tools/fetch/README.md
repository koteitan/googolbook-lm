# Googology Wiki Archive Fetcher

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

## Configuration

Archive URL and paths can be configured at the top of `fetch.py`:

```python
ARCHIVE_URL = 'https://s3.amazonaws.com/wikia_xml_dumps/g/go/googology_pages_current.xml.7z'
DATA_DIR = '../../data'
```

## License

This fetcher tool respects the original content licensing. The downloaded Googology Wiki content is licensed under [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).