# contributors

Analyzes the Googology Wiki XML export to identify contributors with the highest page creation counts.

## Overview

Processes the complete MediaWiki XML export to identify users who have created the most pages, helping with content curation decisions.

## Usage

```bash
cd tools/contributors
python3 contributors.py
```

## Output

Generates `contributors.md` with contributors who created 1000+ pages ranked by page count.

## Output Example

See the generated report: [contributors.md](contributors.md)

## Requirements

- Python 3.x
- Standard library modules: `xml.etree.ElementTree`, `os`, `typing`, `collections`

## Data Source

Requires the Googology Wiki XML export (`googology_pages_current.xml`). If not present, run:

```bash
cd tools/fetch
python3 fetch.py
```

## License

This analysis tool and its output contain content from the Googology Wiki, which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).