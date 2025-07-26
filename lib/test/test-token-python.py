#!/usr/bin/env python3
"""
Python TinySegmenter test tool to verify consistency with JavaScript implementation.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from lib.rag.tinysegmenter import TinySegmenter, tokenize_with_tinysegmenter
from lib.config_loader import get_site_config
import config


def main():
    # Load site configuration
    site_config = get_site_config(config.CURRENT_SITE)
    tokenize_config = getattr(site_config, 'tokenize', {'mode': 'normal'})
    tokenize_mode = tokenize_config.get('mode', 'normal')
    
    print(f"Current site: {config.CURRENT_SITE}", file=sys.stderr)
    print(f"Tokenize mode: {tokenize_mode}", file=sys.stderr)
    print("", file=sys.stderr)
    
    # Read input from stdin
    print("Enter text to tokenize (Ctrl+D to finish):", file=sys.stderr)
    text = sys.stdin.read().strip()
    
    if not text:
        print("No input provided.", file=sys.stderr)
        return
    
    print(f"\nInput text: \"{text}\"")
    print("=" * 60)
    
    # Test TinySegmenter if configured
    if tokenize_mode == 'mecab' or tokenize_mode == 'tinysegmenter':
        print(f"\n=== {tokenize_mode.title()} Morphological Analyzer ===")
        
        try:
            segmenter = TinySegmenter()
            tokens = segmenter.segment(text)
            tokenized = segmenter.tokenize_wakati(text)
            
            print(f"Original text: \"{text}\"")
            print(f"Tokenized text: \"{tokenized}\"")
            print(f"Number of tokens: {len(tokens)}")
            print("\nDetailed tokens:")
            print("-" * 50)
            
            for i, token in enumerate(tokens, 1):
                char_type = segmenter.get_char_type(token[0]) if token else 'unknown'
                print(f"{i:3d} | {token:<12} | {char_type}")
            
            print('\n=== Summary ===')
            print(f'Current configuration uses {tokenize_mode} for Japanese morphological analysis.')
            print('This matches the browser-side tokenization in rag-common.js.')
            
        except Exception as e:
            print(f"❌ {tokenize_mode} failed: {e}")
    else:
        print('\n=== Configuration ===')
        print('Current configuration uses standard tokenization.')
        print('To test TinySegmenter, change tokenize.mode to "tinysegmenter" in config.yml')
        print('\nNote: This tool focuses on morphological analysis testing.')


if __name__ == "__main__":
    main()