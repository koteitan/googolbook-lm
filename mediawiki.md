# MediaWiki XML Export Format

## Overview

MediaWiki XML exports are standardized XML files that contain complete wiki data including pages, revisions, metadata, and site configuration. The format follows the MediaWiki XML Export Schema version 0.11 specification.

## File Structure

### Root Element
```xml
<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" 
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://www.mediawiki.org/xml/export-0.11/ http://www.mediawiki.org/xml/export-0.11.xsd"
           version="0.11" xml:lang="en">
```

### Main Sections

1. **`<siteinfo>`** - Site metadata and configuration
2. **`<page>`** elements - Individual wiki pages with content and history

## Site Information (`<siteinfo>`)

Contains wiki metadata:

- **`<sitename>`** - Name of the wiki (e.g., "Googology Wiki")
- **`<dbname>`** - Database name identifier
- **`<base>`** - Base URL of the wiki
- **`<generator>`** - MediaWiki version (e.g., "MediaWiki 1.39.7")
- **`<case>`** - Case sensitivity rules ("first-letter" is standard)
- **`<namespaces>`** - Complete namespace definitions

### Namespace Structure

Namespaces organize different types of content:

| Key | Type | Description |
|-----|------|-------------|
| -2  | Media | Media files |
| -1  | Special | Special pages |
| 0   | (Main) | Main articles |
| 1   | Talk | Article discussion pages |
| 2   | User | User pages |
| 3   | User talk | User discussion pages |
| 4   | Project | Project/wiki-specific pages |
| 6   | File | File description pages |
| 8   | MediaWiki | System messages |
| 10  | Template | Template pages |
| 14  | Category | Category pages |

Additional namespaces may exist for specific wiki features (Forums, Blogs, Modules, etc.).

## Page Structure (`<page>`)

Each page element contains:

- **`<title>`** - Page title
- **`<ns>`** - Namespace number
- **`<id>`** - Unique page ID
- **`<revision>`** - Page content and revision data

### Revision Data (`<revision>`)

Contains the actual content and metadata:

- **`<id>`** - Unique revision ID
- **`<parentid>`** - Previous revision ID (for edit history)
- **`<timestamp>`** - Creation time (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ)
- **`<contributor>`** - Editor information
- **`<comment>`** - Edit summary
- **`<minor/>`** - Present if marked as minor edit
- **`<model>`** - Content model (usually "wikitext")
- **`<format>`** - Content format (usually "text/x-wiki")
- **`<text>`** - Actual wiki markup content
- **`<sha1>`** - SHA1 hash of the content

### Contributor Information (`<contributor>`)

For registered users:
```xml
<contributor>
  <username>Username</username>
  <id>12345</id>
</contributor>
```

For anonymous users:
```xml
<contributor>
  <ip>192.168.1.1</ip>
</contributor>
```

## Content Format

The actual page content is stored in MediaWiki markup format within `<text>` elements. This includes:

- Wiki markup syntax (`[[links]]`, `{{templates}}`, etc.)
- Plain text content
- Special wiki syntax and formatting
- Categories, templates, and other wiki structures

## Processing Considerations

### File Size
- XML exports can be very large (200MB+ for substantial wikis)
- Use streaming or chunked processing for large files
- Consider memory usage when parsing

### Character Encoding
- Files use UTF-8 encoding
- XML entities may be used for special characters
- The `xml:space="preserve"` attribute maintains whitespace

### Data Integrity
- SHA1 hashes provide content verification
- Revision history is preserved chronologically
- All metadata is retained for forensic analysis

## Common Use Cases

1. **Wiki Migration** - Moving content between MediaWiki instances
2. **Backup and Archival** - Long-term storage of wiki data
3. **Data Analysis** - Studying wiki content and editing patterns
4. **Content Extraction** - Converting wiki markup to other formats
5. **Research** - Academic analysis of collaborative editing

## Schema Reference

The format follows the official MediaWiki XML Export Schema:
- Namespace: `http://www.mediawiki.org/xml/export-0.11/`
- Schema Location: `http://www.mediawiki.org/xml/export-0.11.xsd`
- Version: 0.11 (current standard)