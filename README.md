# GoogolBook LM

A RAG-powered Q&A system for Googology Wiki content. This system uses Retrieval-Augmented Generation (RAG) to provide accurate answers about googology concepts by searching through wiki content and generating responses with LLM assistance.

## Overview

GoogolBook LM enables users to ask questions about googology and receive AI-generated answers backed by actual wiki sources. The system searches through vectorized wiki content to find relevant information before generating responses.

## Live Demo

Try the system online:
- **English Version**: [https://koteitan.github.io/googolbook-lm/data/googology-wiki/](https://koteitan.github.io/googolbook-lm/data/googology-wiki/)
- **Japanese Version**: [https://koteitan.github.io/googolbook-lm/data/ja-googology-wiki/](https://koteitan.github.io/googolbook-lm/data/ja-googology-wiki/)

## Data Sources

This system uses content from:
- [Googology Wiki](https://googology.fandom.com/) - The English googology community wiki
- [巨大数研究 Wiki](https://googology.fandom.com/ja/) - The Japanese googology community wiki

## System Architecture

The RAG system follows a clear data processing pipeline from MediaWiki XML dumps to searchable vector representations:

```mermaid
%% Rule of mermaid
%% - The object is written as vertex.
%% - The function or process are written as edge.
%% - The subgraph is user operation to run.
graph TD
    subgraph fetch_xml["fetch.py"]
        Z[MediaWiki Archive URL] -->|download| Y[Compressed Archive]
        Y -->|py7zr.unpack| A[MediaWiki XML]
    end
    
    subgraph xml2vec["xml2vec.js"]
        A -->|XMLParser| B[Document documents]
        B -->|TinySegmenter tokenization| B2[Tokenized documents]
        B2 -->|Transformers.js| C[Document embeddings]
        C -->|JSON.stringify| D[vector_store_part.json.gz]
        A -->|gzip compression| E[XML.gz for web]
    end
    
    subgraph vec2json["vec2json.py"]
        D -->|pickle.load| F[vector_store_part.json.gz]
        D -->|json.dump| G[vector_store_meta.json]
    end
    
    subgraph load_data["Load Data Button"]
        F -->|pako.inflate| H[Minimal Vector Store]
        G --> H
        E -->|loadCompressedXML| I[Compressed XML Data]
    end
    
    subgraph send_button["Send Button"]
        J[User Query] -->|TinySegmenter + Transformers.js| K[Query Vector]
        K -->|cosineSimilarity| L[Search Results with chunk positions]
        H -->|cosineSimilarity| L
        I -->|getPageFromXML| M[Page Data Object]
        L --> N[Chunk Start/End Positions]
        M -->|extractChunkContent| O[Extracted Chunk Content]
        N -->|extractChunkContent| O
        O -->|map with citations| P[Context with Citations]
        P -->|template literal| Q[System Prompt]
        Q -->|fetch OpenAI API| R[LLM Response with Citations]
    end
    
    subgraph python_search["rag_search.py"]
        S[Query] -->|similarity_search| T[Python Search Results]
        D -->|similarity_search| T
        T -->|format_results_with_citations| U[Python Context with Citations]
        U -->|build_system_prompt| V[Python System Prompt]
        V -->|--show-prompt flag| W[Display LLM Context]
    end
```

## Multi-Site Architecture

The project supports multiple wiki sites with independent interfaces:

- **English Googology Wiki**: `/data/googology-wiki/index.html`
- **Japanese Googology Wiki**: `/data/ja-googology-wiki/index.html`

Each site features:
- Site-specific configuration (`config.yml`)
- Pre-processed vector store data files
- Localized user interface
- Independent RAG search functionality

Shared components are located in the root directory (`index.css`) and lib directory (`lib/rag-common.js`).

## Requirements

### Python Backend (optional, for XML processing)
Python 3.x is required only if using Python tools:

```bash
# For data fetching (tools/fetch/)
pip install py7zr

# For RAG system (tools/rag/ - Python version)
pip install langchain langchain-community langchain-text-splitters langchain-openai
pip install langchain-huggingface  # For HuggingFace embeddings
pip install faiss-cpu  # or faiss-gpu for GPU support
pip install sentence-transformers  # For HuggingFace model downloads
pip install lxml  # For XML parsing
pip install mwxml  # For MediaWiki XML parsing
pip install mwparserfromhell  # For MediaWiki markup parsing
```

### Node.js Frontend (recommended)
For the unified JavaScript/Node.js workflow:

```bash
npm install  # Installs @xenova/transformers and other dependencies
```

The system now supports two approaches:
1. **Node.js-only**: Use `tools/rag/xml2vec.js` for consistent embedding generation
2. **Python backend**: Use `tools/rag/xml2vec.py` + `tools/rag/vec2json.py` (legacy)

For detailed tool-specific documentation, see:
- [tools/fetch/README.md](tools/fetch/README.md) - Data fetching tool
- [tools/rag/README.md](tools/rag/README.md) - RAG system implementation

## Library

See [lib/README.md](lib/README.md) for detailed documentation of the analysis library functions.

## Tools

See [tools/README.md](tools/README.md) for available analysis tools and data processing flow.
