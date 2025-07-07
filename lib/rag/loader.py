"""MediaWiki XML document loading utilities."""

from typing import List
from langchain_core.documents import Document
from langchain_community.document_loaders import MWDumpLoader
import config


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
    
    # Enhance metadata for each document
    for doc in documents:
        if 'source' in doc.metadata:
            title = doc.metadata['source']
            doc.metadata.update({
                'title': title,
                'id': f'page_{title.replace(" ", "_")}',  # Generate ID from title
                'url': f'{config.SITE_BASE_URL}/wiki/{title.replace(" ", "_")}',
                'namespace': 0  # We filtered for main namespace
            })
    
    return documents