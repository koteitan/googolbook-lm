"""Custom MediaWiki loader with enhanced metadata extraction."""

import xml.etree.ElementTree as ET
from typing import List, Optional, Iterator
from langchain_core.documents import Document
from langchain_community.document_loaders import MWDumpLoader
import mwparserfromhell
import config


class EnhancedMWDumpLoader(MWDumpLoader):
    """Enhanced MediaWiki dump loader that extracts additional metadata."""
    
    def __init__(
        self,
        file_path: str,
        namespaces: Optional[List[int]] = None,
        skip_redirects: bool = True,
        stop_on_error: bool = True,
    ):
        super().__init__(file_path, namespaces, skip_redirects, stop_on_error)
        self.site_base_url = config.SITE_BASE_URL
        self.ns = config.MEDIAWIKI_NS  # MediaWiki namespace
    
    def _load_pages(self) -> Iterator[tuple]:
        """Override to extract more metadata from pages."""
        
        def _ns(tag):
            """Get namespaced tag."""
            return f"{{{self.ns}}}{tag}"
        
        try:
            for event, elem in ET.iterparse(self.file_path, events=("start", "end")):
                if event == "start":
                    if elem.tag == _ns("page"):
                        page_data = {}
                
                elif event == "end":
                    if elem.tag == _ns("title"):
                        page_data["title"] = elem.text
                    
                    elif elem.tag == _ns("ns"):
                        page_data["namespace"] = int(elem.text or 0)
                    
                    elif elem.tag == _ns("id") and "page_id" not in page_data:
                        # First ID is page ID
                        page_data["page_id"] = elem.text
                    
                    elif elem.tag == _ns("revision"):
                        # Get revision data
                        revision_elem = elem
                        
                        # Extract text content
                        text_elem = revision_elem.find(_ns("text"))
                        if text_elem is not None and text_elem.text:
                            page_data["content"] = text_elem.text
                        
                        # Extract timestamp
                        timestamp_elem = revision_elem.find(_ns("timestamp"))
                        if timestamp_elem is not None:
                            page_data["timestamp"] = timestamp_elem.text
                        
                        # Extract revision ID
                        rev_id_elem = revision_elem.find(_ns("id"))
                        if rev_id_elem is not None:
                            page_data["revision_id"] = rev_id_elem.text
                    
                    elif elem.tag == _ns("page"):
                        # Page processing complete
                        if "title" in page_data and "content" in page_data:
                            # Filter by namespace
                            if self.namespaces is None or page_data.get("namespace", 0) in self.namespaces:
                                # Skip redirects if requested
                                if self.skip_redirects and page_data["content"].strip().startswith("#REDIRECT"):
                                    elem.clear()
                                    continue
                                
                                yield page_data
                        
                        elem.clear()
                        
        except Exception as e:
            if self.stop_on_error:
                raise e
            else:
                print(f"Error parsing XML: {e}")
    
    def load(self) -> List[Document]:
        """Load documents with enhanced metadata."""
        documents = []
        
        for page in self._load_pages():
            # Create document with full metadata
            metadata = {
                "title": page.get("title", "Unknown"),
                "id": page.get("page_id", "N/A"),
                "url": f"{self.site_base_url}/wiki/{page.get('title', '').replace(' ', '_')}" if page.get("title") else "N/A",
                "namespace": page.get("namespace", 0),
                "timestamp": page.get("timestamp", "N/A"),
                "revision_id": page.get("revision_id", "N/A"),
                "source": page.get("title", "Unknown")  # Keep for compatibility
            }
            
            # Clean wiki markup if possible
            try:
                parsed = mwparserfromhell.parse(page["content"])
                content = parsed.strip_code()
            except:
                content = page["content"]
            
            document = Document(
                page_content=content,
                metadata=metadata
            )
            documents.append(document)
        
        return documents