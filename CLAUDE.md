# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains XML data from the Googology Wiki, specifically wiki page exports in MediaWiki XML format. The project is focused on processing or analyzing googology-related content for LLM support.

## File Structure

```
/
├── data/                           # Data files
│   ├── googology_pages_current.xml    # Main MediaWiki XML export (210MB)
│   └── statistics-googology-wiki-fandom.html  # Wiki statistics page
├── tool/                           # Future processing tools directory
├── mediawiki.md                    # MediaWiki XML format documentation
├── CLAUDE.md                       # This file
├── README.md                       # Project description
└── LICENSE                         # CC BY-SA 3.0 license
```

## Data Specifications

- **Primary Data**: `data/googology_pages_current.xml` (210MB, 3.6M lines)
- **Format**: MediaWiki XML Export Schema version 0.11
- **Source**: Googology Wiki (googology.fandom.com)
- **Content**: Complete wiki dump including all namespaces and revision history
- **Statistics**: HTML page with wiki metrics and usage data

## Architecture

The repository follows a data-centric architecture:
- **Raw Data**: MediaWiki XML export in `data/` directory
- **Documentation**: Comprehensive MediaWiki format documentation in `mediawiki.md`
- **Processing**: `tool/` directory prepared for future XML processing and analysis tools
- **Licensing**: CC BY-SA 3.0 to comply with source content licensing

## All Files Description

### Core Data Files

#### `data/googology_pages_current.xml`
- **Size**: 210MB (3.6M lines)
- **Content**: Complete MediaWiki XML export from Googology Wiki
- **Structure**: Contains site metadata, page content, revision history, and contributor information
- **Format**: MediaWiki XML Export Schema version 0.11 with UTF-8 encoding
- **Usage**: Primary data source for googology concepts and mathematical content

#### `data/statistics-googology-wiki-fandom.html`
- **Size**: Large HTML file with embedded statistics
- **Content**: Wiki statistics page from Fandom showing page counts, user activity, and site metrics
- **Format**: HTML document with embedded JavaScript and CSS
- **Usage**: Reference data for understanding wiki scale and activity patterns

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

### Project Files

#### `LICENSE`
- **Content**: Creative Commons Attribution-ShareAlike 3.0 Unported License
- **Purpose**: Ensures compliance with Googology Wiki source content licensing
- **Requirements**: Attribution and ShareAlike for derivative works

#### `tool/` directory
- **Status**: Empty directory prepared for future development
- **Purpose**: Intended for XML processing scripts, analysis tools, and utilities

## Data Structure

The XML contains:
- Site metadata (namespaces, configuration)
- Page content with full revision history
- MediaWiki markup in `<text>` elements
- Contributor information and edit metadata

### Key Namespaces in Data
- 0: Main articles (googology concepts)
- 1: Talk pages
- 2: User pages
- 4: Googology Wiki project pages
- 6: File pages
- 10: Template pages
- 14: Category pages

## Processing Considerations

### Performance
- **Memory**: File is 210MB - use streaming XML parsers
- **Content**: 3.6M lines with very long lines (1637 chars max)
- **Encoding**: UTF-8 with XML entities

### Common Processing Patterns
- Stream parsing with SAX/XMLReader for large file handling
- Extract specific namespaces (e.g., main articles only)
- Parse MediaWiki markup to extract mathematical concepts
- Build indexes of googology terms and definitions
- Analyze edit patterns and contributor activity

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

## Reference Documentation

See `mediawiki.md` for complete MediaWiki XML format specification including schema details, element structures, and processing guidelines.
