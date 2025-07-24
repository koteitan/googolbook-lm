#!/usr/bin/env python3
"""
Tokenizer test tool for HuggingFace and MeCab tokenizers.

This tool tokenizes input text using both the HuggingFace tokenizer and
MeCab morphological analyzer (if configured), allowing comparison of
tokenization results.

Usage:
    python test-token.py < input.txt
    echo "Hello world" | python test-token.py
    python test-token.py  # Then type text and press Ctrl+D (Unix) or Ctrl+Z (Windows)
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from transformers import AutoTokenizer
from lib.config_loader import get_site_config
import config


def test_huggingface_tokenizer(text: str, model_name: str):
    """Test HuggingFace tokenizer."""
    print(f"\n=== HuggingFace Tokenizer ({model_name}) ===")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Tokenize the text
    tokens = tokenizer.tokenize(text)
    token_ids = tokenizer.convert_tokens_to_ids(tokens)
    
    # Display results
    print(f"Number of tokens: {len(tokens)}")
    print("\nToken ID | Token")
    print("-" * 30)
    
    for token_id, token in zip(token_ids, tokens):
        print(f"{token_id:8d} | {token}")
    
    # Also show the encoded representation (including special tokens)
    encoded = tokenizer.encode(text)
    decoded = tokenizer.decode(encoded)
    
    print(f"\nEncoded (with special tokens): {encoded}")
    print(f"Decoded: {decoded}")


def test_mecab_tokenizer(text: str):
    """Test MeCab morphological analyzer."""
    print(f"\n=== MeCab Morphological Analyzer ===")
    
    try:
        import MeCab
        mecab = MeCab.Tagger("-Owakati")
        
        # Tokenize with MeCab
        morphemes = mecab.parse(text).strip()
        tokens = morphemes.split()
        
        print(f"Number of morphemes: {len(tokens)}")
        print("\nMorphemes:")
        print("-" * 20)
        
        for i, token in enumerate(tokens, 1):
            print(f"{i:3d} | {token}")
        
        print(f"\nTokenized text: {morphemes}")
        
    except ImportError:
        print("MeCab not available. Install with: pip install mecab-python3")
    except Exception as e:
        print(f"MeCab error: {e}")


def main():
    # Load site configuration
    site_config = get_site_config(config.CURRENT_SITE)
    tokenize_config = getattr(site_config, 'tokenize', {'mode': 'normal'})
    tokenize_mode = tokenize_config.get('mode', 'normal')
    
    # Use the same model as in vectorstore.py
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    
    print(f"Current site: {config.CURRENT_SITE}", file=sys.stderr)
    print(f"Tokenize mode: {tokenize_mode}", file=sys.stderr)
    print(f"HuggingFace model: {model_name}", file=sys.stderr)
    
    # Read input from stdin
    print("Enter text to tokenize (Ctrl+D or Ctrl+Z to finish):", file=sys.stderr)
    text = sys.stdin.read().strip()
    
    if not text:
        print("No input provided.", file=sys.stderr)
        return
    
    print(f"\nInput text: {text}")
    print("=" * 50)
    
    # Test HuggingFace tokenizer (always)
    test_huggingface_tokenizer(text, model_name)
    
    # Test MeCab tokenizer if configured or requested
    if tokenize_mode == 'mecab':
        test_mecab_tokenizer(text)
        print("\n=== Comparison ===")
        print("Current configuration uses MeCab for morphological analysis.")
    else:
        print("\n=== Configuration ===")
        print("Current configuration uses standard HuggingFace tokenization.")
        print("To test MeCab, change tokenize.mode to 'mecab' in config.yml")


if __name__ == "__main__":
    main()