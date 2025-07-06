# MediaWiki Analysis Library Documentation

This directory contains a set of Python modules designed for analyzing MediaWiki XML exports. The library provides generic utilities that can be used with any MediaWiki site, with specific configurations handled through the project's config.py file.

## Table of Contents

- [Module Overview](#module-overview)
- [Module Documentation](#module-documentation)
  - [exclusions.py](#exclusionspy)
  - [formatting.py](#formattingpy)
  - [io_utils.py](#io_utilspy)
  - [reporting.py](#reportingpy)
  - [xml_parser.py](#xml_parserpy)

## Module Overview

| Module | Description |
|--------|-------------|
| `__init__.py` | Package initialization file with version information |
| `exclusions.py` | Utilities for handling namespace and username exclusions |
| `formatting.py` | Functions for formatting numbers, bytes, and generating wiki URLs |
| `io_utils.py` | File I/O utilities for finding and reading XML files |
| `reporting.py` | Report generation utilities with licensing information |
| `xml_parser.py` | XML parsing utilities for MediaWiki exports |

## Module Documentation

### exclusions.py

Exclusion handling utilities for Googology Wiki analysis tools. This module provides functions to manage excluded namespaces and usernames when processing wiki data.

#### Functions

##### `load_excluded_namespaces(exclude_file_path: str = None) -> List[str]`
Load excluded namespaces from site configuration.

- **Parameters:**
  - `exclude_file_path` (str, optional): DEPRECATED - kept for compatibility, ignored
- **Returns:**
  - `List[str]`: List of excluded namespace prefixes from site configuration
- **Notes:** The function now reads from the global config instead of a file path

##### `load_excluded_usernames(exclude_file_path: str = None) -> List[str]`
Load excluded usernames from site configuration.

- **Parameters:**
  - `exclude_file_path` (str, optional): DEPRECATED - kept for compatibility, ignored
- **Returns:**
  - `List[str]`: List of excluded usernames from site configuration
- **Notes:** The function now reads from the global config instead of a file path

##### `load_exclusions(exclude_file_path: str = None) -> Tuple[List[str], List[str]]`
Load both excluded namespaces and usernames from site configuration.

- **Parameters:**
  - `exclude_file_path` (str, optional): DEPRECATED - kept for compatibility, ignored
- **Returns:**
  - `Tuple[List[str], List[str]]`: Tuple of (excluded_namespaces, excluded_usernames)

##### `create_namespace_string_to_id_map(namespace_map: Dict[str, str]) -> Dict[str, str]`
Create a mapping from namespace strings to IDs based on XML namespace definitions.

- **Parameters:**
  - `namespace_map` (Dict[str, str]): Dictionary mapping namespace IDs to names from XML
- **Returns:**
  - `Dict[str, str]`: Dictionary mapping namespace strings to IDs
- **Notes:** Includes common string variations for namespace names

##### `should_exclude_page_by_namespace_id(ns_id: str, excluded_namespace_ids: List[str]) -> bool`
Check if a page should be excluded based on its namespace ID.

- **Parameters:**
  - `ns_id` (str): Namespace ID (e.g., "0", "2", "500")
  - `excluded_namespace_ids` (List[str]): List of excluded namespace IDs
- **Returns:**
  - `bool`: True if page should be excluded

##### `convert_excluded_namespaces_to_ids(excluded_namespaces: List[str], namespace_map: Dict[str, str]) -> List[str]`
Convert excluded namespace strings to namespace IDs.

- **Parameters:**
  - `excluded_namespaces` (List[str]): List of excluded namespace strings from exclude.md
  - `namespace_map` (Dict[str, str]): Dictionary mapping namespace IDs to names from XML
- **Returns:**
  - `List[str]`: List of excluded namespace IDs
- **Notes:** Prints warnings for unknown namespace strings

##### `should_exclude_page(title: str, excluded_namespaces: List[str]) -> bool`
Check if a page should be excluded based on its title namespace.

- **Parameters:**
  - `title` (str): Page title
  - `excluded_namespaces` (List[str]): List of excluded namespace prefixes
- **Returns:**
  - `bool`: True if page should be excluded
- **Notes:** DEPRECATED - Use should_exclude_page_by_namespace_id() with namespace ID instead

##### `should_exclude_contributor(contributor_name: str, excluded_usernames: List[str]) -> bool`
Check if a contributor should be excluded based on username.

- **Parameters:**
  - `contributor_name` (str): Contributor username
  - `excluded_usernames` (List[str]): List of excluded usernames
- **Returns:**
  - `bool`: True if contributor should be excluded

---

### formatting.py

Formatting utilities for MediaWiki analysis tools. This module provides functions for formatting numbers, bytes, and generating wiki URLs.

#### Functions

##### `format_number(num: int) -> str`
Format number with commas for readability.

- **Parameters:**
  - `num` (int): Number to format
- **Returns:**
  - `str`: Formatted string with commas
- **Example:** `format_number(1000000)` returns `"1,000,000"`

##### `format_bytes(bytes_count: int) -> str`
Format byte count in human-readable format.

- **Parameters:**
  - `bytes_count` (int): Number of bytes
- **Returns:**
  - `str`: Formatted string with appropriate unit (B, KB, MB, GB, TB)
- **Example:** `format_bytes(1048576)` returns `"1.0 MB"`

##### `generate_wiki_url(title: str) -> str`
Generate a wiki URL from a page title.

- **Parameters:**
  - `title` (str): Page title
- **Returns:**
  - `str`: Complete wiki URL
- **Notes:** Handles URL encoding and space-to-underscore conversion

##### `generate_curid_url(page_id: str) -> str`
Generate a wiki URL using page ID (curid).

- **Parameters:**
  - `page_id` (str): Page ID
- **Returns:**
  - `str`: Complete wiki URL with curid parameter
- **Notes:** Useful for accessing pages by ID rather than title

---

### io_utils.py

File I/O utilities for MediaWiki analysis tools. This module provides functions for locating and reading XML files from the data directory.

#### Functions

##### `get_fetch_date() -> str`
Get the fetch date from the fetch log file.

- **Returns:**
  - `str`: Fetch date string, or 'Unknown' if not available
- **Notes:** Reads from the configured fetch log file

##### `get_latest_xml_info() -> dict`
Get information about the latest downloaded XML from fetch log.

- **Returns:**
  - `dict`: Dictionary with XML path info, or None if not found
- **Notes:** Returns dictionary with keys: xml_path, subdirectory, xml_filename

##### `find_xml_file() -> str`
Find the XML file based on the latest fetch log, falling back to directory search.

- **Returns:**
  - `str`: Path to the XML file if found, None otherwise
- **Notes:** First checks fetch log, then searches data directory

##### `get_xml_file_error_message() -> str`
Get a helpful error message when no XML file is found.

- **Returns:**
  - `str`: Error message explaining how to obtain the XML file
- **Notes:** Provides specific instructions based on current state

##### `get_xml_file() -> str`
Get the XML file path, finding it dynamically if needed.

- **Returns:**
  - `str`: Path to the XML file if found, None otherwise
- **Notes:** Wrapper around find_xml_file()

##### `check_xml_exists() -> bool`
Check if XML file exists and provide helpful error message if not.

- **Returns:**
  - `bool`: True if file exists, False otherwise
- **Notes:** Prints error messages with instructions if file not found

---

### reporting.py

Report generation utilities for Googology Wiki analysis tools. This module provides functions for generating standardized reports with proper licensing information.

#### Functions

##### `generate_license_footer(tool_name: str) -> str`
Generate standard license and attribution footer for reports.

- **Parameters:**
  - `tool_name` (str): Name of the tool generating the report
- **Returns:**
  - `str`: Formatted license footer as markdown string
- **Notes:** Includes CC BY-SA 3.0 license information and timestamps

##### `write_markdown_report(file_path: str, content: str) -> None`
Write markdown content to a file with UTF-8 encoding.

- **Parameters:**
  - `file_path` (str): Path to output file
  - `content` (str): Markdown content to write
- **Returns:**
  - `None`
- **Notes:** Prints confirmation message after writing

---

### xml_parser.py

XML parsing utilities for MediaWiki exports. This module provides functions for parsing MediaWiki XML files and extracting page information.

#### Functions

##### `parse_namespaces(xml_file_path: str) -> Dict[str, str]`
Parse namespace definitions from MediaWiki XML file.

- **Parameters:**
  - `xml_file_path` (str): Path to the MediaWiki XML export file
- **Returns:**
  - `Dict[str, str]`: Dictionary mapping namespace IDs to names
- **Notes:** Stops parsing after namespace definitions to save memory

##### `get_namespace_name(ns_id: str, title: str, namespace_map: Dict[str, str]) -> str`
Get human-readable namespace name from namespace ID and title.

- **Parameters:**
  - `ns_id` (str): Namespace ID as string
  - `title` (str): Page title
  - `namespace_map` (Dict[str, str]): Mapping of namespace IDs to names from XML
- **Returns:**
  - `str`: Human-readable namespace name
- **Notes:** Handles special cases like User blog

##### `extract_page_elements(page_elem) -> Dict[str, Optional[str]]`
Extract common elements from a page XML element.

- **Parameters:**
  - `page_elem`: XML element representing a page
- **Returns:**
  - `Dict[str, Optional[str]]`: Dictionary with extracted elements
- **Notes:** Returns dict with keys: id, title, ns, text, contributor, contributor_id

##### `iterate_pages(xml_file_path: str, show_progress: bool = True) -> Generator[Tuple[int, Dict[str, Optional[str]]], None, None]`
Iterator over pages in MediaWiki XML file with progress reporting.

- **Parameters:**
  - `xml_file_path` (str): Path to the MediaWiki XML export file
  - `show_progress` (bool, optional): Whether to show progress messages (default: True)
- **Yields:**
  - `Tuple[int, Dict[str, Optional[str]]]`: Tuple of (page_count, extracted_elements_dict)
- **Notes:** Memory-efficient iterator that clears elements after processing

---

## Dependencies

All modules in this library depend on:
- Python standard library modules (xml.etree.ElementTree, urllib.parse, os, sys, pathlib, datetime, typing)
- Project-specific `config` module from the parent directory

## Usage Notes

1. All modules import the site-specific configuration from `config.py` in the project root
2. The library is designed to be generic and work with any MediaWiki XML export
3. Site-specific details (URLs, paths, exclusions) are configured in the config module
4. Memory-efficient XML parsing is used throughout to handle large files
5. Progress reporting is built into iterative operations