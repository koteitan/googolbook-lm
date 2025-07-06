# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains XML data from the Googology Wiki, specifically wiki page exports in MediaWiki XML format. The project is focused on processing or analyzing googology-related content for LLM support.

## File Structure

```
/
├── data/ # Data files
│   ├── .dummy # Placeholder to maintain directory structure
│   ├── googology_pages_current.xml   # Main MediaWiki XML export (210MB, not in Git)
│   └── statistics-googology-wiki-fandom.html  # Wiki statistics page
├── lib/               # Shared library modules
│   ├── exclusions.py  # Namespace and user exclusion utilities
│   ├── formatting.py  # Number and text formatting utilities
│   ├── io_utils.py    # File I/O and XML detection utilities
│   ├── reporting.py   # Report generation utilities
│   └── xml_parser.py  # MediaWiki XML parsing utilities
├── tools/             # Analysis and processing tools
│   ├── */             # each tool
│   │   ├── README.md  # Tool documentation
│   │   ├── *.py       # Script
│   │   └── *.md       # Generated analysis report
├── tools/             # Analysis and processing tools
│   ├── contributors/  # Contributor analysis tool
│   ├── large-pages/   # Large page analysis tool
│   ├── namespaces/    # Namespace statistics tool
│   ├── tokens/        # Token counting tool
│   ├── random/        # Random page sampling tool
│   ├── fetch/         # Data fetching tool
│   │   ├── README.md  # Tool documentation
│   │   └── fetch.py   # Data download script
│   ├── dothemall.bash # Execute all analysis tools
│   ├── steps.md       # Analysis steps documentation
│   └── README.md      # Tools overview documentation
├── config.py          # Central configuration constants
├── exclude.md         # Exclusion rules for analysis
├── mediawiki.md       # MediaWiki XML format documentation
├── CLAUDE.md          # This file
├── README.md          # Project description
├── LICENSE            # CC BY-SA 3.0 license
└── .gitignore         # Git ignore rules
```

## Architecture

The repository follows a modular, library-based architecture:
- **Raw Data**: MediaWiki XML export in `data/` directory (large files excluded from Git)
- **Shared Library**: `lib/` directory with reusable analysis utilities
- **Analysis Tools**: `tools/` directory with specialized analysis scripts using shared library
- **Configuration**: Centralized settings in `config.py` and user exclusions in `exclude.md`
- **Documentation**: Comprehensive MediaWiki format documentation in `mediawiki.md`
- **Licensing**: CC BY-SA 3.0 to comply with source content licensing

## All Files Description

### Core Data Files

#### `data/googology_pages_current.xml`
- **Size**: 210MB (3.6M lines)
- **Content**: Complete MediaWiki XML export from Googology Wiki
- **Structure**: Contains site metadata, page content, revision history, and contributor information
- **Format**: MediaWiki XML Export Schema version 0.11 with UTF-8 encoding
- **Usage**: Primary data source for googology concepts and mathematical content
- **Git Status**: Excluded from repository via `.gitignore` due to large file size

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

#### `lib/xml_parser.py`
- **Purpose**: MediaWiki XML parsing utilities
- **Functions**: `parse_namespaces()`, `get_namespace_name()`, `extract_page_elements()`, `iterate_pages()`
- **Key Feature**: Handles XML namespace URI `{http://www.mediawiki.org/xml/export-0.11/}` for accurate element extraction
- **Usage**: Provides streaming XML parsing with memory efficiency for large files

#### `lib/exclusions.py`
- **Purpose**: Namespace and user exclusion utilities
- **Functions**: `should_exclude_page_by_namespace_id()`, `convert_excluded_namespaces_to_ids()`, `load_excluded_namespaces()`
- **Key Feature**: Unified namespace ID-based exclusion system with string-to-ID mapping
- **Usage**: Converts exclude.md string settings to accurate namespace ID filtering

#### `lib/formatting.py`
- **Purpose**: Number and text formatting utilities
- **Functions**: `format_number()`, `format_bytes()`, `generate_wiki_url()`
- **Usage**: Consistent formatting across all analysis reports

#### `lib/io_utils.py`
- **Purpose**: File I/O and XML detection utilities
- **Functions**: `find_xml_file()`, `get_xml_file()`, `check_xml_exists()`, `get_fetch_date()`
- **Usage**: Automatic XML file detection and path handling

#### `lib/reporting.py`
- **Purpose**: Report generation utilities
- **Functions**: `generate_license_footer()`, `write_markdown_report()`
- **Usage**: Standardized markdown report generation with licensing compliance

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

### Configuration Files

#### `config.py`
- **Purpose**: Central configuration constants
- **Contents**: Site information, file paths, MediaWiki XML namespace URI
- **Key Constant**: `MEDIAWIKI_NS = '{http://www.mediawiki.org/xml/export-0.11/}'` for XML parsing
- **Usage**: Imported by all tools and library modules

#### `exclude.md`
- **Purpose**: User-configurable exclusion rules
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
