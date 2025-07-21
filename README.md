# GoogolBook LM
Googology Wiki LLM support

## Multi-Site Architecture

This project now supports multiple sites with independent web interfaces:

- **English Googology Wiki**: Access via `/data/googology-wiki/index.html`
- **Japanese Googology Wiki**: Access via `/data/ja-googology-wiki/index.html`

Each site has its own:
- Site-specific configuration (`config.yml`)
- Vector store data files
- Localized web interface

Shared components are located in the root directory (`rag-common.js`, `index.css`).

## Requirements

Before using this project, install the required Python dependencies:

```bash
pip install requests beautifulsoup4 py7zr
```

## Library

See [lib/README.md](lib/README.md) for detailed documentation of the analysis library functions.

## Tools

See [tools/README.md](tools/README.md) for available analysis tools and data processing flow.
