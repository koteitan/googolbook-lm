#!/usr/bin/env python3
"""
Detailed tokenization analysis - Split positions and character-level mapping
"""

import sys
import os
import json

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from transformers import AutoTokenizer

def analyze_character_to_token_mapping(text, tokenizer):
    """Character-level tokenization analysis"""
    print(f"\n=== Character-level tokenization analysis ===")
    print(f"Original text: '{text}'")
    print(f"Character count: {len(text)}")
    
    # Tokenization
    inputs = tokenizer(text, return_tensors='pt', padding=True, truncation=True)
    token_ids = inputs['input_ids'].tolist()[0]
    tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
    
    print(f"\nToken IDs: {token_ids}")
    print(f"Tokens: {tokens}")
    print(f"Token count: {len(tokens)}")
    
    # Extract content tokens excluding special tokens
    content_tokens = []
    content_token_ids = []
    
    for i, (token_id, token) in enumerate(zip(token_ids, tokens)):
        # Skip special tokens (<s>, </s>, ▁, etc.)
        if token not in ['<s>', '</s>', '<pad>', '<unk>', '<mask>']:
            content_tokens.append(token)
            content_token_ids.append(token_id)
    
    print(f"\nContent tokens: {content_tokens}")
    print(f"Content Token IDs: {content_token_ids}")
    
    # Analyze character-to-token correspondence
    print(f"\n=== Character-to-token correspondence ===")
    
    # Decode to identify character positions
    decoded_text = tokenizer.decode(token_ids, skip_special_tokens=True)
    print(f"Decode result: '{decoded_text}'")
    
    # Individual token decoding
    print(f"\n=== Individual token analysis ===")
    char_position = 0
    
    for i, (token_id, token) in enumerate(zip(token_ids, tokens)):
        if token in ['<s>', '</s>']:
            print(f"Token {i:2d}: '{token}' (ID: {token_id}) → Special token")
            continue
            
        # Individual decoding
        individual_decoded = tokenizer.decode([token_id], skip_special_tokens=True)
        print(f"Token {i:2d}: '{token}' (ID: {token_id}) → Decode: '{individual_decoded}'")
        
        # Estimate character position
        if individual_decoded in text:
            position = text.find(individual_decoded, char_position)
            if position != -1:
                print(f"         Character position: {position}-{position + len(individual_decoded)} ('{text[position:position + len(individual_decoded)]}')")
                char_position = position + len(individual_decoded)
    
    return {
        'original_text': text,
        'token_ids': token_ids,
        'tokens': tokens,
        'content_tokens': content_tokens,
        'decoded_text': decoded_text
    }

def analyze_morphological_boundaries(text, tokenizer):
    """Morphological boundary analysis"""
    print(f"\n=== Morphological boundary analysis ===")
    
    # MeCab reference result
    try:
        import MeCab
        mecab = MeCab.Tagger("-Owakati")
        mecab_result = mecab.parse(text).strip()
        mecab_words = mecab_result.split()
        print(f"MeCab morphological analysis: {mecab_words}")
    except:
        print(f"MeCab not available")
        mecab_words = []
    
    # Tokenizer result
    inputs = tokenizer(text, return_tensors='pt')
    tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
    
    # Remove special tokens
    content_tokens = [t for t in tokens if t not in ['<s>', '</s>', '<pad>', '<unk>', '<mask>']]
    
    # Process ▁ (space symbol)
    processed_tokens = []
    for token in content_tokens:
        if token.startswith('▁'):
            # Remove ▁ and get actual character string
            processed_tokens.append(token[1:] if len(token) > 1 else '')
        elif token == '▁':
            # Pure space token
            processed_tokens.append('[SPACE]')
        else:
            processed_tokens.append(token)
    
    # Remove empty strings
    processed_tokens = [t for t in processed_tokens if t]
    
    print(f"Tokenizer result: {processed_tokens}")
    
    # Boundary comparison
    print(f"\n=== Boundary comparison ===")
    print(f"MeCab boundary count: {len(mecab_words) - 1 if mecab_words else 0}")
    print(f"Tokenizer boundary count: {len(processed_tokens) - 1}")
    
    if mecab_words:
        print(f"\nMeCab words:")
        for i, word in enumerate(mecab_words):
            print(f"  {i+1:2d}. '{word}'")
    
    print(f"\nTokenizer words:")
    for i, token in enumerate(processed_tokens):
        print(f"  {i+1:2d}. '{token}'")
    
    # Match analysis
    if mecab_words:
        print(f"\n=== Match analysis ===")
        mecab_text = ''.join(mecab_words)
        tokenizer_text = ''.join(processed_tokens)
        
        print(f"MeCab recombined: '{mecab_text}'")
        print(f"Tokenizer recombined: '{tokenizer_text}'")
        print(f"Original text: '{text}'")
        
        if mecab_text == text and tokenizer_text == text:
            print("✅ Both match original text")
        elif tokenizer_text == text:
            print("✅ Only Tokenizer matches original text")
        elif mecab_text == text:
            print("✅ Only MeCab matches original text")
        else:
            print("❌ Neither matches original text")

def main():
    print("=== Detailed tokenization analysis ===")
    
    # Test text
    test_text = "巨大数は、気の遠くなるほど大きな有限の数である。"
    
    # Multilingual model tokenizer
    model_name = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    
    print(f"Model: {model_name}")
    print(f"Test text: '{test_text}'")
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Character-level analysis
        char_analysis = analyze_character_to_token_mapping(test_text, tokenizer)
        
        # Morphological boundary analysis
        analyze_morphological_boundaries(test_text, tokenizer)
        
        # Save results
        output_file = os.path.join(os.path.dirname(__file__), "tokenization_analysis.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(char_analysis, f, ensure_ascii=False, indent=2)
        
        print(f"\nAnalysis results saved: {output_file}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()