#!/usr/bin/env python3
"""
Tokenizer test tool for HuggingFace embeddings.

This tool tokenizes input text using the same tokenizer as the HuggingFace
embeddings model used in the vector store, displaying token IDs and their
corresponding text representations.

Usage:
    python token.py < input.txt
    echo "Hello world" | python token.py
    python token.py  # Then type text and press Ctrl+D (Unix) or Ctrl+Z (Windows)
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from transformers import AutoTokenizer


def main():
    # Use the same model as in vectorstore.py
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Load tokenizer
    print(f"Loading tokenizer for model: {model_name}", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Read input from stdin
    print("Enter text to tokenize (Ctrl+D or Ctrl+Z to finish):", file=sys.stderr)
    text = sys.stdin.read().strip()
    
    if not text:
        print("No input provided.", file=sys.stderr)
        return
    
    # Tokenize the text
    tokens = tokenizer.tokenize(text)
    token_ids = tokenizer.convert_tokens_to_ids(tokens)
    
    # Display results
    print(f"\nInput text: {text}")
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


if __name__ == "__main__":
    main()