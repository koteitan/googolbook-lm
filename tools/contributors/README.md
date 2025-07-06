# contributors

Analyzes MediaWiki XML exports to identify contributors with the highest page creation counts.

## Overview

Processes MediaWiki XML exports to identify users who have created the most pages, helping with content curation decisions. Pages and contributors specified in the project's exclusion guidelines (exclude.md) are automatically filtered out from the analysis.

## Usage

```bash
cd tools/contributors
python3 contributors.py
```

## Output

Generates `contributors.md` with contributors who created 1000+ pages ranked by page count.

## Output Example

See the generated report: [contributors.md](contributors.md)

## License

[Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).
