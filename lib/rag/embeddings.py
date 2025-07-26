"""Japanese morphological analysis embeddings for improved tokenization."""

from typing import List
from langchain.embeddings.base import Embeddings
from .tinysegmenter import tokenize_with_tinysegmenter


class JapaneseMorphologicalEmbeddings(Embeddings):
    """
    Wrapper for embeddings that performs Japanese morphological analysis
    using MeCab before passing text to the base embedding model.
    """
    
    def __init__(self, base_embeddings: Embeddings):
        """
        Initialize with a base embeddings model.
        
        Args:
            base_embeddings: The base embedding model to wrap
        """
        self.base_embeddings = base_embeddings
        self.mecab = None
        self._mecab_available = self._check_mecab_availability()
        if self._mecab_available:
            self._initialize_mecab()
    
    def _check_mecab_availability(self):
        """Check if MeCab is available without initializing it."""
        try:
            import MeCab
            return True
        except ImportError:
            print("⚠ Warning: MeCab not available. Install with: pip install mecab-python3")
            print("⚠ Falling back to base embeddings without morphological analysis")
            return False
    
    def _initialize_mecab(self):
        """Initialize MeCab tokenizer with error handling."""
        if not self._mecab_available:
            return
            
        try:
            import MeCab
            self.mecab = MeCab.Tagger("-Owakati")
            print("✓ MeCab initialized successfully for morphological analysis")
        except Exception as e:
            print(f"⚠ Warning: MeCab initialization failed: {e}")
            print("⚠ Falling back to base embeddings without morphological analysis")
            self._mecab_available = False
            self.mecab = None
    
    def __getstate__(self):
        """Custom pickling to exclude non-serializable MeCab object."""
        state = self.__dict__.copy()
        # Remove the MeCab tagger object as it's not pickle-able
        state['mecab'] = None
        return state
    
    def __setstate__(self, state):
        """Custom unpickling to reinitialize MeCab object."""
        self.__dict__.update(state)
        # Reinitialize MeCab if it was available
        if self._mecab_available:
            self._initialize_mecab()
    
    def _preprocess(self, text: str) -> str:
        """
        Preprocess text using MeCab morphological analysis.
        
        Args:
            text: Input text to tokenize
            
        Returns:
            Tokenized text (space-separated morphemes) or original text if MeCab unavailable
        """
        # Ensure MeCab is initialized
        if self.mecab is None and self._mecab_available:
            self._initialize_mecab()
        
        if self.mecab is None:
            return text
        
        try:
            # MeCab tokenization (-Owakati produces space-separated output)
            tokenized = self.mecab.parse(text).strip()
            return tokenized
        except Exception as e:
            print(f"⚠ Warning: MeCab tokenization failed: {e}")
            return text
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of documents with morphological preprocessing.
        
        Args:
            texts: List of document texts to embed
            
        Returns:
            List of embedding vectors
        """
        processed_texts = [self._preprocess(text) for text in texts]
        return self.base_embeddings.embed_documents(processed_texts)
    
    def embed_query(self, text: str) -> List[float]:
        """
        Embed a query text with morphological preprocessing.
        
        Args:
            text: Query text to embed
            
        Returns:
            Embedding vector
        """
        processed_text = self._preprocess(text)
        return self.base_embeddings.embed_query(processed_text)


class TinySegmenterEmbeddings(Embeddings):
    """
    Wrapper for embeddings that performs Japanese morphological analysis
    using TinySegmenter before passing text to the base embedding model.
    This matches the browser-side JavaScript implementation.
    """
    
    def __init__(self, base_embeddings: Embeddings):
        """
        Initialize with a base embeddings model.
        
        Args:
            base_embeddings: The base embedding model to wrap
        """
        self.base_embeddings = base_embeddings
        print("✓ TinySegmenter initialized successfully for morphological analysis")
    
    def _preprocess(self, text: str) -> str:
        """
        Preprocess text using TinySegmenter morphological analysis.
        
        Args:
            text: Input text to tokenize
            
        Returns:
            Tokenized text (space-separated tokens)
        """
        try:
            # TinySegmenter tokenization (matches JavaScript implementation)
            tokenized = tokenize_with_tinysegmenter(text)
            return tokenized
        except Exception as e:
            print(f"⚠ Warning: TinySegmenter tokenization failed: {e}")
            return text
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of documents with TinySegmenter preprocessing.
        
        Args:
            texts: List of document texts to embed
            
        Returns:
            List of embedding vectors
        """
        processed_texts = [self._preprocess(text) for text in texts]
        return self.base_embeddings.embed_documents(processed_texts)
    
    def embed_query(self, text: str) -> List[float]:
        """
        Embed a query text with TinySegmenter preprocessing.
        
        Args:
            text: Query text to embed
            
        Returns:
            Embedding vector
        """
        processed_text = self._preprocess(text)
        return self.base_embeddings.embed_query(processed_text)