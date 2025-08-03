#!/usr/bin/env python3
"""
Testing with multilingual embedding models
"""

import sys
import os
import json
import numpy as np
import torch

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModel

def test_model(model_name, text):
    """Process text with specified model"""
    print(f"\n=== Model: {model_name} ===")
    print(f"Text: '{text}'")
    
    try:
        # Test with SentenceTransformer
        print(f"\n--- SentenceTransformer ---")
        sentence_model = SentenceTransformer(model_name)
        embedding = sentence_model.encode(text, convert_to_numpy=True)
        print(f"✅ Success - Embedding shape: {embedding.shape}")
        print(f"   Embedding (first 5): {embedding[:5].tolist()}")
        
        # Detailed tokenizer check
        print(f"\n--- Tokenizer details ---")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        inputs = tokenizer(text, return_tensors='pt')
        
        print(f"Token IDs: {inputs['input_ids'].tolist()[0]}")
        tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
        print(f"Tokens: {tokens}")
        
        # Check number of [UNK] tokens
        unk_count = tokens.count('[UNK]')
        print(f"[UNK] token count: {unk_count}")
        
        return {
            'model_name': model_name,
            'success': True,
            'embedding': embedding.tolist(),
            'token_ids': inputs['input_ids'].tolist()[0],
            'tokens': tokens,
            'unk_count': unk_count,
            'embedding_dimension': len(embedding)
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return {
            'model_name': model_name,
            'success': False,
            'error': str(e)
        }

def main():
    print("=== Multilingual embedding model test ===")
    
    # Test text
    test_text = "グラハム数"
    
    # Test target models
    models_to_test = [
        # Original model (for comparison)
        'sentence-transformers/all-MiniLM-L6-v2',
        
        # Multilingual models
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        'sentence-transformers/distiluse-base-multilingual-cased',
        'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
        
        # Japanese-specific model (if available)
        'sentence-transformers/stsb-xlm-r-multilingual',
    ]
    
    results = []
    
    for model_name in models_to_test:
        try:
            result = test_model(model_name, test_text)
            results.append(result)
            
            if result['success']:
                print(f"✅ {model_name}: Success ([UNK]: {result['unk_count']} tokens)")
            else:
                print(f"❌ {model_name}: Failed")
                
        except Exception as e:
            print(f"❌ {model_name}: Skipped - {e}")
            results.append({
                'model_name': model_name,
                'success': False,
                'error': str(e)
            })
    
    # Result comparison
    print(f"\n=== Result comparison ===")
    successful_results = [r for r in results if r['success']]
    
    print(f"Successful models: {len(successful_results)}/{len(models_to_test)}")
    
    if len(successful_results) >= 2:
        print(f"\n--- [UNK] token count comparison ---")
        for result in successful_results:
            status = "🟢 Good" if result['unk_count'] == 0 else f"🔴 {result['unk_count']} tokens"
            print(f"  {result['model_name']}: {status}")
        
        # Recommend models with least UNK tokens
        best_models = [r for r in successful_results if r['unk_count'] == 0]
        if best_models:
            print(f"\n🎯 Recommended models (no [UNK]):")
            for model in best_models:
                print(f"  - {model['model_name']}")
                print(f"    Dimensions: {model['embedding_dimension']}")
                print(f"    Token count: {len(model['tokens'])}")
        else:
            min_unk = min(r['unk_count'] for r in successful_results)
            best_models = [r for r in successful_results if r['unk_count'] == min_unk]
            print(f"\n🔶 Relatively good models ([UNK]: {min_unk} tokens):")
            for model in best_models:
                print(f"  - {model['model_name']}")
                print(f"    Dimensions: {model['embedding_dimension']}")
    
    # Save results to JSON file
    output_file = os.path.join(os.path.dirname(__file__), "multilingual_test_results.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\nDetailed results saved: {output_file}")

if __name__ == '__main__':
    main()