"""MediaWiki XML document loading utilities."""

from typing import List
from langchain_core.documents import Document
from langchain_community.document_loaders import MWDumpLoader


def load_mediawiki_documents(xml_path: str, namespace_filter: List[int] = None) -> List[Document]:
    """
    Load documents from MediaWiki XML dump file.
    
    Args:
        xml_path: Path to the MediaWiki XML dump file
        namespace_filter: List of namespace IDs to include (default: [0] for main articles)
        
    Returns:
        List of Document objects with page content and metadata
    """
    if namespace_filter is None:
        namespace_filter = [0]  # Default to main namespace only
        
    loader = MWDumpLoader(
        file_path=xml_path,
        namespaces=namespace_filter
    )
    
    documents = loader.load()
    return documents