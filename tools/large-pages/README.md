# Large Pages Analyzer

This tool analyzes the Googology Wiki XML export to identify pages with the largest content sizes.

## Overview

The Large Pages Analyzer (`large-pages.py`) processes the complete MediaWiki XML export from the Googology Wiki and generates a comprehensive report of the largest pages by character count. This analysis helps identify content-heavy pages and understand the distribution of page sizes across the wiki.

## Features

- **Complete XML Analysis**: Processes the entire 210MB Googology Wiki XML export
- **Memory Efficient**: Uses streaming XML parsing to handle large files
- **Comprehensive Statistics**: Provides detailed statistics on page size distribution
- **Direct Wiki Links**: Each page title in the report links directly to the original wiki page
- **Namespace Analysis**: Shows distribution of large pages across different namespaces
- **Proper Attribution**: Includes CC BY-SA 3.0 license compliance and attribution

## Usage

```bash
cd tools/large-pages
python3 large-pages.py
```

## Output

The script generates `large-pages.md` containing:

- **Summary Statistics**: Total pages analyzed, largest page size, average page size
- **Top 100 Largest Pages**: Ranked table with page size, title (linked), and namespace
- **Size Distribution**: Number of pages in various size categories (>100KB, >50KB, etc.)
- **Namespace Distribution**: Breakdown of large pages by wiki namespace
- **License Information**: Proper attribution and licensing details

## Configuration

File paths can be configured at the top of `large-pages.py`:

```python
# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'large-pages.md'
```

## Requirements

- Python 3.x
- Standard library modules: `xml.etree.ElementTree`, `os`, `typing`, `urllib.parse`, `datetime`

## Data Source

The analysis is performed on the Googology Wiki XML export (`googology_pages_current.xml`), which contains:

- **73,776 total pages** across all namespaces
- **73,210 pages with content** 
- Complete revision history and metadata
- MediaWiki markup in original format

## Sample Results

The largest pages typically include:

- **Decimal Expansions**: Large mathematical constants with thousands of digits
- **User Blogs**: Detailed mathematical analysis and notation systems
- **User Pages**: Research notes and extended mathematical content
- **Templates**: Large data structures and mathematical expressions

## License

This analysis tool and its output contain content from the Googology Wiki, which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

All output includes proper attribution to the original content creators and contributors of the Googology Wiki.