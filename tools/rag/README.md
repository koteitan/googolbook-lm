# LangChain RAG System Specification

## RAG Processing Flow

The LangChain RAG system follows a clear data processing pipeline from MediaWiki XML dumps to searchable vector representations:

```mermaid
graph TD
    A[xml] -->|MWDumpLoader.load| B[Document documents]
    B -->|RecursiveCharacterTextSplitter.split_documents| C[Document chunks]
    C -->|FAISS.from_documents| D[vector_store]
    
    E[query] -->|vector_store.similarity_search_with_score| F[results]
    D -->|vector_store.similarity_search_with_score| F
```

### Function References

* **MWDumpLoader**
  * How To: [MediaWiki Dump Loader](https://python.langchain.com/docs/integrations/document_loaders/mediawikidump/)
  * Reference: [MWDumpLoader API](https://python.langchain.com/api_reference/community/document_loaders/langchain_community.document_loaders.mediawikidump.MWDumpLoader.html)

* **RecursiveCharacterTextSplitter**
  * How To: [Text Splitters](https://python.langchain.com/docs/concepts/text_splitters/)
  * Reference: [RecursiveCharacterTextSplitter API](https://python.langchain.com/api_reference/text_splitters/character/langchain_text_splitters.character.RecursiveCharacterTextSplitter.html)

* **FAISS**
  * How To: [FAISS Vector Store](https://python.langchain.com/docs/integrations/vectorstores/faiss/)
  * Reference: [FAISS API](https://python.langchain.com/api_reference/community/vectorstores/langchain_community.vectorstores.faiss.FAISS.html)

## Object Structure Overview

### [Document](https://python.langchain.com/api_reference/core/documents/langchain_core.documents.base.Document.html) Class
- **page_content**: `str` - Raw text content of the chunk/article
- **metadata**: `dict` - Dictionary containing:
  - **title**: `str` - Wiki article title
  - **id**: `str` - Unique wiki page identifier
  - **url**: `str` - Full URL to the original wiki page
  - **namespace**: `int` - MediaWiki namespace (0 = main articles)
  - **categories**: `list[str]` - Article category tags
  - **timestamp**: `str` - Last modification timestamp
  - **revision_id**: `str` - Revision identifier

### [FAISS](https://python.langchain.com/api_reference/community/vectorstores/langchain_community.vectorstores.faiss.FAISS.html) Vector Store Class
- **index**: `faiss.IndexFlatIP` - FAISS index object containing:
  - **ntotal**: `int` - Total number of stored vectors
  - **d**: `int` - Vector dimension size
  - **get_vector(i)**: `numpy.ndarray` - Retrieve vector at index i
- **docstore**: `InMemoryDocstore` - Document storage containing:
  - **_dict**: `dict[str, Document]` - Document mapping where:
    - **key**: `str` - document_id
    - **value**: `Document` - Document object with page_content and metadata
- **index_to_docstore_id**: `dict[int, str]` - Vector index to document ID mapping where:
  - **key**: `int` - vector_index
  - **value**: `str` - document_id
- **embedding_function**: `BaseEmbeddings` - Embedding function with methods:
  - **embed_query(text)**: `list[float]` - Convert query text to vector
  - **embed_documents(texts)**: `list[list[float]]` - Convert document texts to vectors

### Search Results Structure
- **results**: `list[tuple[Document, float]]` - List of tuples containing:
  - **[0]**: `tuple[Document, float]` - First result tuple:
    - **[0]**: `Document` - Document object with:
      - **page_content**: `str` - Matching chunk text content
      - **metadata**: `dict` - Original metadata (title, id, url, etc.)
    - **[1]**: `float` - Similarity score (0.0 - 1.0)
  - **[1]**: `tuple[Document, float]` - Second best match
  - **[n]**: `tuple[Document, float]` - nth best match

## Requirements

To use the RAG system, install the following Python packages:

```bash
pip install langchain langchain-community langchain-text-splitters langchain-openai
pip install faiss-cpu  # or faiss-gpu for GPU support
pip install sentence-transformers  # For HuggingFace embeddings
pip install lxml  # For XML parsing
```

## Usage

### Basic Usage

Search for information about Graham's Number:

```bash
python tools/rag/rag_search.py "What is Graham's Number?"
```

### Command Line Options

```bash
python tools/rag/rag_search.py [query] [options]

Options:
  --xml-file PATH         Path to XML file (auto-detected if not specified)
  --cache PATH            Path to cache file for vector store (default: cache/vector_store.pkl)
  --no-cache              Disable caching
  --rebuild               Force rebuild of vector store even if cache exists
  --chunk-size SIZE       Chunk size for text splitting (default: 1000)
  --chunk-overlap SIZE    Chunk overlap for text splitting (default: 200)
  --top-k K               Number of results to return (default: 5)
  --score-threshold SCORE Minimum similarity score threshold
```

### Examples

Search with custom parameters:
```bash
python tools/rag/rag_search.py "TREE(3)" --top-k 10 --chunk-size 500
```

Rebuild vector store:
```bash
python tools/rag/rag_search.py "Fast-growing hierarchy" --rebuild
```

## Implementation Notes

1. The system uses HuggingFace embeddings by default (specifically the `all-MiniLM-L6-v2` model) to avoid requiring OpenAI API keys.
2. Vector stores are cached to disk for faster subsequent searches.
3. Only main namespace articles (namespace=0) are indexed by default.
4. The MWDumpLoader automatically extracts metadata including title, URL, and page ID from the MediaWiki XML.