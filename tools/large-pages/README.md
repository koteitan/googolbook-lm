# Large Pages Analysis

Analyzes MediaWiki XML exports to identify the largest pages by content size.

## Overview

Processes the MediaWiki XML export and generates a report of the largest pages ranked by character count. Pages specified in the project's exclusion guidelines (exclude.md) are automatically filtered out from the analysis.

## Usage

```bash
cd tools/large-pages
python3 large-pages.py
```

## Output

Generates `large-pages.md` with:
- Summary statistics and page counts
- Top 100 largest pages with direct wiki links
- Size distribution analysis
- License and attribution information

## Example Results

See the generated report: [large-pages.md](large-pages.md)

## License

[Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).
