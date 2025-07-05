# Contributors Analyzer

Analyzes the Googology Wiki XML export to identify contributors with the highest page creation counts.

## Overview

The Contributors Analyzer (`contributors.py`) processes the complete MediaWiki XML export from the Googology Wiki to identify users who have created the most pages. This analysis helps identify potential automated content generation patterns and supports content curation decisions.

## Features

- **Complete XML Analysis**: Processes the entire Googology Wiki XML export
- **Page Creation Tracking**: Identifies original page creators vs. editors
- **Ranking System**: Ranks contributors by number of pages created
- **Curation Support**: Helps identify potentially auto-generated or redundant content
- **Memory Efficient**: Uses streaming XML parsing for large files

## Usage

```bash
cd tools/contributors
python3 contributors.py
```

## Output

Generates `contributors.md` with:
- Summary statistics and contributor counts
- Top contributors ranked by page creation count
- Analysis for content curation purposes
- License and attribution information

## Requirements

- Python 3.x
- Standard library modules: `xml.etree.ElementTree`, `os`, `typing`, `collections`

## Data Source

The analysis requires the Googology Wiki XML export (`googology_pages_current.xml`). If not present, run:

```bash
cd tools/fetch
python3 fetch.py
```

## Use Cases

- **Content Curation**: Identify contributors who may have created many similar pages
- **Quality Assessment**: Find patterns in bulk page creation
- **Community Analysis**: Understand contribution patterns in the wiki
- **Automated Content Detection**: Spot potential bot or script-generated content

## License

This analysis tool and its output contain content from the Googology Wiki, which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).