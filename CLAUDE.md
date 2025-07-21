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

## Architecture

The repository follows a modular, library-based architecture:
- **Raw Data**: MediaWiki XML export in `data/[CURRENT_SITE]/` directory (large files excluded from Git)
- **Shared Library**: `lib/` directory with reusable analysis utilities
- **Analysis Tools**: `tools/` directory with specialized analysis scripts using shared library
- **Configuration**: 
  - Central settings in `config.py` (including `CURRENT_SITE` variable)
  - Site-specific settings in `data/[CURRENT_SITE]/config.py`
  - User exclusions in `data/[CURRENT_SITE]/exclude.md`
- **Documentation**: Comprehensive MediaWiki format documentation in `mediawiki.md`
- **Licensing**: CC BY-SA 3.0 to comply with source content licensing

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

#### `mediawiki.md`
- **Content**: Comprehensive documentation of MediaWiki XML export format
- **Details**: Schema specifications, element structures, processing guidelines
- **Usage**: Essential reference for understanding XML data structure and parsing requirements

#### `README.md`
- **Content**: Brief project description
- **Usage**: Basic project identification

#### `CLAUDE.md` (this file)
- **Content**: Guidance for Claude Code when working with this repository
- **Usage**: Instructions for future AI assistance with data processing

### Shared Library (`lib/`)

See **[lib/README.md](lib/README.md)** for detailed documentation of all library modules and their functions.

### Analysis Tools (`tools/`)

#### `tools/fetch/`
- **Purpose**: Data download and extraction utilities
- **Features**: Automatic file detection and logging
- **Output**: `data/*.xml` - Extracted XML files

#### `tools/namespaces/`
- **Purpose**: Namespace statistics and content distribution analysis
- **Features**: Uses shared XML parsing and exclusion libraries
- **Output**: `namespace.md` - Markdown report

#### `tools/tokens/`
- **Purpose**: Token counting for LLM analysis using tiktoken (OpenAI GPT-4)
- **Features**: Namespace ID-based filtering for accurate token counting
- **Output**: `tokens.md` - Markdown report

#### `tools/contributors/`
- **Purpose**: Contributor analysis by page creation count
- **Features**: Excludes system users and applies namespace filtering
- **Output**: `contributors.md` - Markdown report

#### `tools/large-pages/`
- **Purpose**: Analysis tool for identifying largest pages in the wiki
- **Features**: Legacy tool being updated to use shared library
- **Output**: `large-pages.md` - Markdown report

#### `tools/random/`
- **Purpose**: Random page sampling for quality assessment
- **Features**: Namespace-aware sampling with exclusion support
- **Output**: `index.html` - Web interface for browsing random pages

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

## Data Structure

The XML contains:
- Site metadata (namespaces, configuration)
- Page content with full revision history
- MediaWiki markup in `<text>` elements
- Contributor information and edit metadata

## Processing Considerations

### Common Processing Patterns
- **Streaming XML Parsing**: Use `lib/xml_parser.py` with `iterate_pages()` for memory-efficient processing
- **Namespace Filtering**: Use `lib/exclusions.py` with namespace ID-based exclusion for accurate filtering
- **Automatic File Detection**: Use `lib/io_utils.py` to find XML files without hardcoding paths
- **Standardized Reporting**: Use `lib/reporting.py` and `lib/formatting.py` for consistent output
- **Configuration Management**: Import settings from `config.py` and exclusions from `exclude.md`

### XML Namespace Handling
- **Namespace URI**: All XML elements require `MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'` prefix
- **Element Finding**: Use `elem.find(f'.//{config.MEDIAWIKI_NS}id')` instead of `elem.find('.//id')`
- **Reason**: MediaWiki XML uses XML namespaces per W3C standards to avoid element name conflicts
- **Dynamic Namespace Mapping**: Parse `<siteinfo><namespaces>` section for site-specific namespace definitions

## MediaWiki XML Format Details

The repository includes comprehensive documentation of the MediaWiki XML export format in `mediawiki.md`. Key format details:

### XML Structure
- Root element: `<mediawiki>` with namespace declarations
- Two main sections: `<siteinfo>` and `<page>` elements
- Schema version 0.11 with UTF-8 encoding

### Page Structure
Each `<page>` contains:
- `<title>`, `<ns>` (namespace), `<id>` (page ID)
- `<revision>` with content, timestamps, contributors
- `<text>` elements containing MediaWiki markup
- SHA1 hashes for content verification

### Processing Notes from mediawiki.md
- Files use `xml:space="preserve"` to maintain whitespace
- Contributor info includes usernames/IDs or IP addresses
- Content model is typically "wikitext" format
- Revision history is preserved chronologically
- XML namespace URI required for all element access
- Namespace definitions in `<siteinfo>` provide ID-to-name mapping

## Development Guidelines

### Using Shared Libraries
- **Always import** from `lib/` modules instead of duplicating functionality
- **Use namespace ID-based exclusion** via `lib/exclusions.py` instead of title-based filtering
- **Import configuration** from `config.py` for consistent settings
- **Use streaming parsing** via `lib/xml_parser.py` for memory efficiency

### Code Organization
- **Shared functionality** goes in `lib/` directory
- **Tool-specific code** stays in respective `tools/` subdirectories
- **Configuration constants** in `config.py` only (no functions)
- **Utility functions** distributed across appropriate `lib/` modules

## Reference Documentation

- **`mediawiki.md`**: Complete MediaWiki XML format specification including schema details, element structures, and processing guidelines
- **`tools/README.md`**: Overview of all analysis tools and their purposes
- **`tools/steps.md`**: Documentation of common analysis steps and shared operations
- **Individual tool READMEs**: Specific documentation for each analysis tool

## Recent Architecture Changes

### Refactoring to Shared Library (Latest)
- **Created `lib/` directory** with shared utilities to eliminate code duplication (~200 lines removed)
- **Centralized configuration** in `config.py` with dynamic XML file detection
- **Standardized report generation** with consistent formatting and licensing

## rules
- Always get user permission before git commit
- Don't use `git push`
