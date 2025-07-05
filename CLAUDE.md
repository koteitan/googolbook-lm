# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains XML data from the Googology Wiki, specifically wiki page exports in MediaWiki XML format. The project is focused on processing or analyzing googology-related content for LLM support.

## Data Specifications

- **File**: `googology_pages_current.xml` (210MB, 3.6M lines)
- **Format**: MediaWiki XML Export Schema version 0.11
- **Source**: Googology Wiki (googology.fandom.com)
- **Content**: Complete wiki dump including all namespaces and revision history

## Architecture

The repository follows a data-centric architecture:
- **Raw Data**: MediaWiki XML export as single large file
- **Documentation**: Comprehensive MediaWiki format documentation in `mediawiki.md`
- **Processing**: No code yet - designed for future XML processing and analysis tools

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
