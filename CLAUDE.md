# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This site is a chat with RAG for MediaWiki. The site user put the question in the prompt window, then the LLM will answer the question with the help of the RAG system.

## Specification

### Parts

- **index**: The main page.
  - **Prompt window**: Textbox for user questions.
  - **Send button**: Button to submit the user's question.
  - **Response window**: Displays the response from the RAG system.
  - **RAG window**: Displays the RAG search results.
  - **Data loading button**: Button to start loading the vector store.
  - **data loading meter**: Progress bar showing the status of data loading.
  - **Base URL window**: Textbox for the base URL of the LLM API.
    - Default: ChatGPT default
  - **API Key window**: Textbox for the API key of the LLM service. (hidden characters)
- Backyard:
  - Vector store
  - RAG system
  - LLM interface

### Behavior

  - On clicking the "Data loading" button, the vector store loading process starts.
    - the vector stores on `data/[CURRENT_SITE]/` is loaded on the memory.
    - While the vector store is loading, the data loading meter is displayed.
    - If the vector store is already loaded, the send button is enabled.
  - On clicking the "Send" button, the question in the prompt window is processed:
    - The question is sent to the RAG system.
    - The RAG system searches for relevant documents in the vector store.
    - The LLM generates a response based on the retrieved documents.
    - The response is displayed in the response window.
    - The RAG search results with the link are displayed in the RAG window.

## Inner Specification
  - The JavaScript codes for the site are in the root directory.
  - The HTML and CSS files are in the root directory, index.html and index.css.
  - There is no server-side code. The site made with HTML, JavaScript, and CSS.
  - The vector store is already created and stored in `data/[CURRENT_SITE]/`.
  - The vector store is loaded as zipped pickle file.
  - tools/rag/xml2vec.py is used to create the vector store zip file.

## File Structure

```
/
├── index.{html,js,css} # Main HTML, JavaScript, and CSS files for the web interface
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
- Speak to me in Japanese.
- git commit is denied. Please suggest the commit message by the following format:
```markdown
-----------------------------commit message begin
[top line]

- [details]
- [details]
- [details]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
-----------------------------commit message end
```
- Don't use `git push`
- I run the following commands because it will take a long time to run. Please  request me to run these commands:
  - tools/rag/xml2vec.py
  - tools/rag/vec2json.py
  - tools/fetch/fetch.py
