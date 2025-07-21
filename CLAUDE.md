# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains XML data from the Googology Wiki, specifically wiki page exports in MediaWiki XML format. The project is focused on processing or analyzing googology-related content for LLM support.

## File Structure

```
/
├── data/              # Data files
│   └── [CURRENT_SITE]/   # Site-specific data (e.g., googology-wiki, ja-googology-wiki)
│       ├── analysis/     # Generated analysis reports
│       │   ├── README.md
│       │   ├── contributors.md
│       │   ├── namespaces.md
│       │   ├── random.html
│       │   └── tokens.md
│       ├── config.py     # Site-specific configuration (contains SITE_NAME, SITE_BASE_URL, etc.)
│       ├── exclude.md    # Site-specific exclusions
│       ├── fetch_log.txt # Download log
│       ├── [site]_pages_current.xml # MediaWiki XML export (e.g., googology_pages_current.xml)
│       └── vector_store.pkl # RAG vector store cache
├── lib/               # Shared library modules
│   ├── README.md      # Library documentation
│   ├── __init__.py    # Package initialization
│   ├── exclusions.py  # Namespace and user exclusion utilities
│   ├── formatting.py  # Number and text formatting utilities
│   ├── io_utils.py    # File I/O and XML detection utilities
│   ├── reporting.py   # Report generation utilities
│   ├── xml_parser.py  # MediaWiki XML parsing utilities
│   ├── rag/           # RAG (Retrieval-Augmented Generation) utilities
│   │   ├── __init__.py    # Package initialization
│   │   ├── custom_loader.py # Custom MWDumpLoader (unused)
│   │   ├── loader.py      # MediaWiki document loading with curid URL support
│   │   ├── splitter.py    # Document text splitting for chunks
│   │   └── vectorstore.py # FAISS vector store creation and search
│   └── test/          # Test scripts
├── tools/             # Analysis and processing tools
│   ├── fetch/         # Data fetching tool
│   │   ├── README.md  # Tool documentation
│   │   └── fetch.py   # Data download script
│   ├── rag/           # RAG (Retrieval-Augmented Generation) search tool
│   │   ├── README.md  # RAG tool documentation
│   │   ├── xml2vec.py # Vector store creation from XML
│   │   └── rag_search.py # Interactive RAG search interface
│   └── README.md      # Tools overview documentation
├── config.py          # Central configuration constants
├── exclude.md         # Exclusion rules for analysis
├── CLAUDE.md          # This file
├── README.md          # Project description
├── LICENSE            # CC BY-SA 3.0 license
└── .gitignore         # Git ignore rules
```

## All Files Description

### Core Data Files

#### `data/[CURRENT_SITE]/[site]_pages_current.xml`
- **Size**: Varies by site (e.g., 210MB for English Googology Wiki)
- **Content**: Complete MediaWiki XML export from the specified wiki
- **Structure**: Contains site metadata, page content, revision history, and contributor information
- **Format**: MediaWiki XML Export Schema version 0.11 with UTF-8 encoding
- **Usage**: Primary data source for googology concepts and mathematical content
- **Git Status**: Excluded from repository via `.gitignore` due to large file size
- **Examples**: 
  - `data/googology-wiki/googology_pages_current.xml` (English)
  - `data/ja-googology-wiki/jagoogology_pages_current.xml` (Japanese)

### Documentation Files

### Shared Library (`lib/`)

See **[lib/README.md](lib/README.md)** for detailed documentation of all library modules and their functions.

### Analysis Tools (`tools/`)

#### `tools/fetch/`
- **Purpose**: Data download and extraction utilities
- **Features**: Automatic file detection and logging
- **Output**: `data/*.xml` - Extracted XML files

#### `tools/rag/`
- **Purpose**: RAG (Retrieval-Augmented Generation) search system for semantic search
- **Features**: 
  - Vector store creation from MediaWiki XML using FAISS
  - Interactive search with similarity scoring
  - Curid-based URL generation for terminal compatibility
  - Dynamic namespace filtering including User blog content
- **Components**:
  - `xml2vec.py`: Creates vector store from XML data
  - `rag_search.py`: Interactive search interface
  - `README.md`: Comprehensive documentation
- **Output**: `data/[CURRENT_SITE]/vector_store.pkl` - Cached vector stores

### Configuration Files

#### `config.py`
- **Purpose**: Central configuration constants
- **Contents**: 
  - `CURRENT_SITE`: Active site directory name (e.g., 'googology-wiki', 'ja-googology-wiki')
  - `MEDIAWIKI_NS`: XML namespace URI for parsing
  - `DATA_DIR`: Path to current site data directory
- **Key Constants**: 
  - `MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'`
  - `CURRENT_SITE = 'googology-wiki'` (default)
- **Usage**: Imported by all tools and library modules

#### `data/[CURRENT_SITE]/config.py`
- **Purpose**: Site-specific configuration
- **Contents**: Site name, base URL, excluded namespaces
- **Examples**: 
  - `SITE_NAME = 'Googology Wiki'`
  - `SITE_BASE_URL = 'https://googology.fandom.com'`
  - `EXCLUDED_NAMESPACES` list
- **Usage**: Loaded dynamically based on `CURRENT_SITE`

#### `data/[CURRENT_SITE]/exclude.md`
- **Purpose**: Site-specific exclusion rules
- **Format**: Markdown list of namespace prefixes and usernames to exclude
- **Examples**: `- File:`, `- Template:`, `- <username>FANDOM</username>`
- **Usage**: Processed by lib/exclusions.py for namespace ID-based filtering

#### `.gitignore`
- **Purpose**: Defines files and patterns to exclude from Git tracking
- **Key Exclusions**: Large XML data file, Python cache files, IDE settings

## rules
- Always get user permission before git commit
- Don't use `git push`
