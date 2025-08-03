# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This site is a chat with RAG for MediaWiki. The site user put the question in the prompt window, then the LLM will answer the question with the help of the RAG system.

## Site Specification

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

## Vector Store Generation Steps
1. **Download MediaWiki XML**: Use `tools/fetch/fetch.py` to download the MediaWiki XML dump.
2. **Create Vector Store**: Run `tools/rag/xml2vec.py` to create the vector store from the downloaded XML.
3. **Convert to JSON**: Run `tools/rag/vec2json.py` to convert the vector store to a gzip JSON format.

## File Structure

```
/
├── .claude/settings.json    # Claude Code settings
├── CLAUDE.md                # This file
├── README.md                # Project description
├── config.py                # Central configuration constants
├── index.{html,js,css}      # Main HTML, JavaScript, and CSS files for the web interface
├── data/                    # Data files
│   ├── [site]/              # each MediaWiki data
│   │   ├── analysis/        # Generated analysis reports
│   │   ├── config.yml       # Site-specific YAML configuration
│   │   ├── fetch_log.txt    # Download log
│   │   ├── vector_store_meta.json      # Vector store metadata
│   │   ├── [site]_pages_current.xml    # MediaWiki XML archive
│   │   ├── vector_store.pkl            # Vector store in pickle format
│   │   ├── vector_store_partXX.json.gz # Vector store in gzip JSON format
│   │   ├── index.html       # HTML file for the site
│   │   ├── index.css        # CSS file for the site
│   │   └── index.js         # JavaScript file for the site
├── lib/                     # Shared library modules
│   ├── README.md            # Library documentation
│   ├── __init__.py          # Package initialization
│   ├── config_loader.py     # YAML configuration loading utilities
│   ├── exclusions.py        # Namespace and user exclusion utilities
│   ├── formatting.py        # Number and text formatting utilities
│   ├── io_utils.py          # File I/O and XML detection utilities
│   ├── reporting.py         # Report generation utilities
│   ├── test/                # Test scripts
│   ├── xml_parser.py        # MediaWiki XML parsing utilities
│   ├── js/                  # JavaScript modules
│       ├── rag-common.js        # Common RAG functionality for web interface
│       └── test/                # JavaScript tests
│           └── test-token.js    # Tokenization testing tool
│   ├── rag/                 # RAG (Retrieval-Augmented Generation) utilities
│       ├── __init__.py      # Package initialization
│       ├── custom_loader.py # Custom MWDumpLoader (unused)
│       ├── embeddings.py    # MeCab morphological analysis for Japanese embeddings
│       ├── loader.py        # MediaWiki document loading with curid URL support
│       ├── splitter.py      # Document text splitting for chunks
│       └── vectorstore.py   # FAISS vector store creation and search
├── tools/                   # Analysis and processing tools
│   ├── README.md            # Tools overview documentation
│   ├── fetch/               # Data fetching tool
│   │   ├── README.md        # Tool documentation
│   │   └── fetch.py         # Data download script
│   ├── rag/                 # RAG (Retrieval-Augmented Generation) search tool
│   │   ├── README.md        # RAG tool documentation
│   │   ├── xml2vec.py       # Vector store creation from XML
│   │   ├── vec2json.py      # Converts vector store to gzip of JSON format
│   │   ├── test-token.py    # Tokenize testing tool
│   │   └── rag_search.py    # Interactive RAG search interface
├── LICENSE                  # CC BY-SA 3.0 license
├── .github/workflows/       # GitHub Actions
│   └── manual.yml
└── .gitignore               # Git ignore rules
```

## implementation notes
- data/[site]/vector_store_\*.json.gz don't include titles and bodies. They include only curids. The titles and bodies are in .xml by curid.
- For body search, the page bodies are converted to vector store.
- For title search, the page titles are converted to vector store.
- The redirecting page behavior:
  - For body search, the redirecting page is not included in the vector store. (because the body is no information)
  - For title search, the redirecting page is included in the vector store and if the vector store is hit, the body of the destination page is shown to the LLM.

## rules
- Speak to me in Japanese.
- git add . is denied because it may include unnecessary files. Please add files one by one.
- git commit is denied. Please suggest the commit message in English by the following format:
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
  - When you make the commit message, please check `git log -1` and avoid duplicating the last commit message.
  - Don't use `git push`
  - I check browser by myself. Please don't check browser.

