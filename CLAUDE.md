# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains XML data from the Googology Wiki, specifically wiki page exports in MediaWiki XML format. The project appears to be focused on processing or analyzing googology-related content.

## File Structure

- `googology_pages_current.xml` - MediaWiki XML export containing Googology Wiki pages and content
- `/llm/` - Working directory containing a copy of the XML data

## Data Format

The XML files follow MediaWiki export format (version 0.11) containing:
- Site metadata and namespace definitions
- Page content with titles, revisions, and wiki markup
- Full wiki structure including talk pages, user pages, templates, etc.

## Working with the Data

When processing the XML data:
- The files are large (200MB+) - use streaming or chunked processing
- Content is in MediaWiki markup format
- Pages include various namespaces (articles, talk pages, user pages, templates, etc.)
- Each page has revision history and metadata

## Common Operations

Since this is a data processing project with XML files, typical operations might include:
- Parsing XML content with appropriate XML libraries
- Extracting specific pages or content types
- Converting MediaWiki markup to other formats
- Analyzing wiki structure and relationships