# GoogolBook LM
Googology Wiki LLM support

## Features

- **[fetch](tools/fetch/README.md)** - Downloads and extracts the official Googology Wiki XML export archive from the Wikia/Fandom servers.
- **[large pages](tools/large-pages/README.md)** - Identifies and analyzes the largest pages in the Googology Wiki by content size, providing detailed statistics and direct links to original wiki pages.
- **[contributors](tools/contributors/README.md)** - Analyzes contributors by page creation count to identify the most active content creators in the Googology Wiki.
- **[analyze](tools/analyze/README.md)** - Analyzes content distribution across different namespaces, showing how wiki content is distributed by type (articles, user pages, talk pages, etc.).
- **[random check](tools/random/README.md)** - Generates an interactive HTML page with a button to jump to random Googology Wiki pages for content discovery.

## Data Processing Flow

```mermaid
graph TD
    A[Googology Wiki] -->|fetch.py| B["data/{googology_pages_current.xml, fetch_log.txt}"]
    B -->|contributors.py| C[tools/contributors/contributors.md]
    B -->|large-pages.py| D[tools/large-pages/large-pages.md]
    B -->|analyze.py| E[tools/analyze/analyze.md]
    B -->|random-check.py| F[tools/random/index.html]
```
