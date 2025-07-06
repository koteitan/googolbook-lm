# Namespace Analysis

Analyzes the Googology Wiki XML export to show content distribution across different namespaces.

## Description

This tool processes the MediaWiki XML export and generates statistics showing how content is distributed across different wiki namespaces (Main articles, User pages, Talk pages, Templates, etc.). Results are sorted by total byte size to identify which types of content consume the most space.

## Usage

```bash
cd tools/namespaces
python3 namespaces.py
```

## Output

Generates `namespaces.md` with:
- Summary statistics (total namespaces, pages, content size)
- Detailed table with namespace, bytes, pages, average size, and percentage
- Analysis of the largest namespaces by content size
- Content distribution insights

## Example Output

| Namespace | Bytes | Pages | Avg Size | Percentage |
|-----------|-------|-------|----------|------------|
| Main | 15.2 MB | 25,847 | 612 B | 45.3% |
| User | 8.1 MB | 12,433 | 682 B | 24.1% |
| Talk | 4.7 MB | 8,921 | 551 B | 14.0% |

See the generated analysis: [namespaces.md](namespaces.md)

## Requirements

- Python 3.6+

## License

CC BY-SA 3.0 (matches source content from Googology Wiki)
