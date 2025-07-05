# Random Check for exclude.md

Generates a random page selector for the Googology Wiki that creates an HTML page with a button to jump to random wiki pages.

## Overview

Processes the MediaWiki XML export and generates an HTML page with JavaScript functionality to randomly select and navigate to Googology Wiki pages. Pages specified in the project's exclusion guidelines (exclude.md) are automatically filtered out from the random selection.

## Usage

```bash
cd tools/random
python3 random-jump.py
```

## Output

Generates `index.html` with:
- Interactive button for random page selection
- Real-time display of selected page information
- Statistics about available pages
- Direct links to wiki pages using curid format

## Example Results

See the generated page: [index.html](index.html)

## Configuration

File paths can be configured at the top of `random-jump.py`:

```python
# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'index.html'
```

## Requirements

- Python 3.x
- No additional packages required

## License

This analysis tool and its output contain content from the Googology Wiki, which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

All output includes proper attribution to the original content creators and contributors of the Googology Wiki.
