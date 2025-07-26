"""
TinySegmenter for Python - Lightweight Japanese text segmentation
Port of JavaScript TinySegmenter to match browser-side tokenization
"""

import re
from typing import List


class TinySegmenter:
    """Lightweight Japanese text segmenter matching JavaScript implementation."""
    
    def __init__(self):
        # Character type patterns
        self.patterns = {
            'hiragana': re.compile(r'[\u3041-\u3096]'),
            'katakana': re.compile(r'[\u30A1-\u30F6]'),
            'kanji': re.compile(r'[\u4E00-\u9FAF]'),
            'latin': re.compile(r'[A-Za-z]'),
            'digit': re.compile(r'[0-9]'),
        }
    
    def segment(self, text: str) -> List[str]:
        """
        Segment Japanese text into tokens.
        
        Args:
            text: Input text to segment
            
        Returns:
            List of segmented tokens
        """
        if not text or len(text) == 0:
            return []
        
        result = []
        current = ''
        last_type = None
        
        for char in text:
            char_type = self.get_char_type(char)
            
            if last_type is None:
                current = char
                last_type = char_type
            elif char_type == last_type or self.should_combine(last_type, char_type):
                current += char
            else:
                if current.strip():
                    result.append(current)
                current = char
                last_type = char_type
        
        if current.strip():
            result.append(current)
        
        return result
    
    def get_char_type(self, char: str) -> str:
        """Get character type for a single character."""
        if self.patterns['hiragana'].match(char):
            return 'hiragana'
        elif self.patterns['katakana'].match(char):
            return 'katakana'
        elif self.patterns['kanji'].match(char):
            return 'kanji'
        elif self.patterns['latin'].match(char):
            return 'latin'
        elif self.patterns['digit'].match(char):
            return 'digit'
        else:
            return 'other'
    
    def should_combine(self, type1: str, type2: str) -> bool:
        """Determine if two character types should be combined."""
        # Combine hiragana with kanji (common Japanese patterns)
        if (type1 == 'kanji' and type2 == 'hiragana') or \
           (type1 == 'hiragana' and type2 == 'kanji'):
            return True
        
        # Combine consecutive latin chars and digits
        if (type1 == 'latin' and type2 == 'digit') or \
           (type1 == 'digit' and type2 == 'latin'):
            return True
        
        return False
    
    def tokenize_wakati(self, text: str) -> str:
        """
        Tokenize text in wakati (space-separated) format.
        This matches the output format expected by the embedding system.
        
        Args:
            text: Input text to tokenize
            
        Returns:
            Space-separated tokens
        """
        tokens = self.segment(text)
        return ' '.join(tokens)


# Create global instance for use in embeddings
tiny_segmenter = TinySegmenter()


def tokenize_with_tinysegmenter(text: str) -> str:
    """
    Convenience function for tokenizing text with TinySegmenter.
    
    Args:
        text: Input text to tokenize
        
    Returns:
        Space-separated tokens
    """
    return tiny_segmenter.tokenize_wakati(text)


if __name__ == "__main__":
    # Test the segmenter
    test_cases = [
        "グラハム数",
        "巨大数",
        "フィッシュ数",
        "チェーン記法",
        "ビジービーバー関数",
        "TREE(3)",
        "ack(4,2)"
    ]
    
    segmenter = TinySegmenter()
    
    print("TinySegmenter Python Test:")
    print("=" * 40)
    
    for text in test_cases:
        tokens = segmenter.segment(text)
        wakati = segmenter.tokenize_wakati(text)
        print(f"Original: {text}")
        print(f"Tokens:   {tokens}")
        print(f"Wakati:   {wakati}")
        print("-" * 30)