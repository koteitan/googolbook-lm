# Common Operations Analysis for Tools Refactoring

This document analyzes the common operations performed across the analysis tools to identify opportunities for shared library refactoring.

## Tools Analyzed

1. **tokens/tokens.py** - Token count analysis with exclusion filtering
2. **random/random-check.py** - Random page selector generator
3. **namespaces/namespaces.py** - Namespace distribution analysis
4. **contributors/contributors.py** - Contributor analysis by page creation

## Common Operations Identified

### 1. XML Parsing Operations

#### Namespace Parsing
**Used in:** `tokens.py`, `namespaces.py`
```python
def parse_namespaces(xml_file_path: str) -> dict:
    namespace_map = {}
    for event, elem in ET.iterparse(xml_file_path, events=('start', 'end')):
        if event == 'end' and elem.tag.endswith('}namespace'):
            key = elem.get('key')
            name = elem.text
            if key is not None:
                # Handle main namespace (key="0" has no text content)
                if name is None or name.strip() == '':
                    namespace_map[key] = 'Main'
                else:
                    namespace_map[key] = name
            elem.clear()
        elif event == 'end' and elem.tag.endswith('}page'):
            break  # Stop after first page
    return namespace_map
```

#### Page Iteration with Memory Management
**Used in:** All XML-processing tools
- Iterparse with element clearing for memory efficiency
- Progress reporting every 10,000 pages
- Standard namespace URI: `{http://www.mediawiki.org/xml/export-0.11/}`

#### Page Element Extraction
**Used in:** All XML-processing tools
```python
# Common elements extracted:
ns_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}ns')
title_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}title')
id_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}id')
text_elem = elem.find('.//{http://www.mediawiki.org/xml/export-0.11/}text')
```

### 2. Data Processing Patterns

#### Exclusion Handling
**Used in:** `tokens.py`, `random-check.py`, `contributors.py`, `large-pages.py`

**Loading Excluded Namespaces:**
```python
def load_excluded_namespaces(exclude_file_path: str) -> List[str]:
    excluded_namespaces = []
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- `') and line.endswith(':`'):
                    namespace = line[3:-2]  # Remove "- `" and "`:"
                    excluded_namespaces.append(namespace)
    except Exception as e:
        print(f"Warning: Could not load exclusions from {exclude_file_path}: {e}")
    return excluded_namespaces
```

**Page Exclusion Check:**
```python
def should_exclude_page(title: str, excluded_namespaces: List[str]) -> bool:
    if ':' in title:
        namespace = title.split(':', 1)[0]
        namespace_normalized = namespace.replace('_', ' ')
        return namespace in excluded_namespaces or namespace_normalized in excluded_namespaces
    return False
```

#### Namespace Name Resolution
**Used in:** `tokens.py`, `namespaces.py`, `large-pages.py`
```python
def get_namespace_name(ns_id: str, title: str, namespace_map: dict) -> str:
    # Handle special cases for user blogs
    if ':' in title:
        prefix = title.split(':', 1)[0]
        if prefix == 'User blog':
            return 'User blog'
    # Use the namespace map parsed from XML
    return namespace_map.get(ns_id, f'Namespace {ns_id}')
```

### 3. File I/O Operations

#### Fetch Date Retrieval
**Used in:** All tools except `fetch.py`
**Identical implementation across all tools:**
```python
def get_fetch_date() -> str:
    try:
        with open(FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'
```

#### XML File Existence Check
**Used in:** All XML-processing tools
```python
if not os.path.exists(XML_FILE):
    print(f"Error: XML file not found at {XML_FILE}")
    print("Please run the fetch tool first to download the data.")
    return
```

### 4. Configuration Patterns

**Common configuration constants across tools:**
```python
XML_FILE = '../../data/googology_pages_current.xml'
FETCH_LOG_FILE = '../../data/fetch_log.txt'
EXCLUDE_FILE = '../../exclude.md'
# Output file paths vary by tool
```

### 5. Report Generation Patterns

#### Number Formatting
**Used in:** Multiple tools
```python
def format_number(num):
    """Format number with commas."""
    return f"{num:,}"

def format_bytes(bytes_count: int) -> str:
    """Format byte count in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} TB"
```

#### License Footer Generation
**Nearly identical across all tools:**
```python
## License and Attribution

This analysis contains content from the **Googology Wiki** (googology.fandom.com), which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

- **Original Source**: [Googology Wiki](https://googology.fandom.com)
- **License**: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution**: Content creators and contributors of the Googology Wiki
- **Modifications**: This analysis extracts and reorganizes data from the original wiki content

*Archive fetched: {get_fetch_date()}*  
*Generated by {tool_name}*  
*Analysis date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
```

### 6. Specialized Operations

#### Random Sampling
**Used in:** `random-check.py`, `namespaces.py`
```python
if len(samples) >= 3:
    random_samples = random.sample(samples, 3)
else:
    random_samples = samples
```

#### URL Generation
**Used in:** Multiple tools
```python
# Wiki page URLs with page ID
f"https://googology.fandom.com/?curid={page_id}"

# Wiki page URLs with title (requires encoding)
encoded_title = urllib.parse.quote(title.replace(' ', '_'))
f"https://googology.fandom.com/wiki/{encoded_title}"
```

## Proposed Refactoring Structure

### lib/ Directory Structure
```
tools/lib/
├── __init__.py
├── xml_parser.py      # XML parsing utilities
├── exclusions.py      # Exclusion loading and checking
├── formatting.py      # Number/byte formatting, URL generation
├── reporting.py       # Markdown report generation
├── config.py          # Shared configuration constants
└── io_utils.py        # File I/O helpers
```

### Key Functions to Centralize

**xml_parser.py:**
- `parse_namespaces(xml_file_path) -> dict`
- `iterate_pages(xml_file_path, show_progress=True)` - Generator with progress
- `extract_page_elements(elem) -> dict` - Extract common page elements
- `get_namespace_name(ns_id, title, namespace_map) -> str`

**exclusions.py:**
- `load_exclusions(exclude_file_path) -> Tuple[List[str], List[str]]` - Returns namespaces and usernames
- `should_exclude_page(title, excluded_namespaces) -> bool`
- `should_exclude_contributor(contributor_name, excluded_usernames) -> bool`

**formatting.py:**
- `format_number(num) -> str`
- `format_bytes(bytes_count) -> str`
- `generate_wiki_url(title) -> str`
- `generate_curid_url(page_id) -> str`

**reporting.py:**
- `generate_license_footer(tool_name) -> str`
- `write_markdown_report(file_path, content) -> None`

**config.py:**
- Shared file paths and constants
- MediaWiki namespace URI constant

**io_utils.py:**
- `get_fetch_date() -> str`
- `check_xml_exists(xml_file_path) -> bool`

## Benefits of Refactoring

1. **Reduced Code Duplication** - Common functions used across 3-4 tools
2. **Consistency** - Uniform behavior across all tools
3. **Maintainability** - Bug fixes and improvements applied everywhere
4. **Testing** - Shared functions can be unit tested once
5. **Extensibility** - New tools can easily reuse existing functionality
6. **Performance** - Optimizations benefit all tools simultaneously

## Implementation Priority

**High Priority:**
1. `get_fetch_date()` - Identical across all tools
2. `format_number()` and `format_bytes()` - Used in multiple tools
3. `parse_namespaces()` - Complex logic used in 2+ tools

**Medium Priority:**
1. Exclusion handling functions
2. License footer generation
3. XML element extraction helpers

**Low Priority:**
1. URL generation functions
2. Configuration centralization
3. Advanced report generation helpers