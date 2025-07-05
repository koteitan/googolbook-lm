# Large Pages Analyzer

Analyzes the Googology Wiki XML export to identify the largest pages by content size.

## Overview

Processes the MediaWiki XML export and generates a report of the largest pages ranked by character count.

## Usage

```bash
cd tools/large-pages
python3 large-pages.py
```

## Example Results

See the generated report: [large-pages.md](large-pages.md)

## Configuration

File paths can be configured at the top of `large-pages.py`:

```python
# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'large-pages.md'
```

## Requirements

- Python 3.x
- No additional packages required

## License

This analysis tool and its output contain content from the Googology Wiki, which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

All output includes proper attribution to the original content creators and contributors of the Googology Wiki.