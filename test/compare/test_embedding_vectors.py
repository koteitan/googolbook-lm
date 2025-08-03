#!/usr/bin/env python3
"""
Detailed comparison of embedding vectors - Input layer (Token IDs) and output layer (Embedding)
"""

import sys
import os
import json
import numpy as np
from numpy.linalg import norm

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer

def cosine_similarity(a, b):
    """Calculate cosine similarity"""
    return np.dot(a, b) / (norm(a) * norm(b))

def test_embedding_vectors(model_name, test_texts):
    """Compare embeddings of multiple texts with specified model"""
    print(f"\n=== Model: {model_name} ===")
    
    try:
        # Initialize SentenceTransformer and Tokenizer
        sentence_model = SentenceTransformer(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        results = []
        
        for i, text in enumerate(test_texts):
            print(f"\n--- Text {i+1}: '{text}' ---")
            
            # 1. Token IDs (input layer)
            inputs = tokenizer(text, return_tensors='pt', padding=True, truncation=True)
            token_ids = inputs['input_ids'].tolist()[0]
            attention_mask = inputs['attention_mask'].tolist()[0]
            tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
            
            print(f"Token IDs: {token_ids}")
            print(f"Tokens: {tokens}")
            print(f"Attention mask: {attention_mask}")
            
            # 2. Embedding (output layer)
            embedding = sentence_model.encode(text, convert_to_numpy=True)
            embedding_norm = norm(embedding)
            
            print(f"Embedding shape: {embedding.shape}")
            print(f"Embedding L2 norm: {embedding_norm:.6f}")
            print(f"Embedding (first 5): {embedding[:5].tolist()}")
            print(f"Embedding (last 5): {embedding[-5:].tolist()}")
            
            results.append({
                'text': text,
                'token_ids': token_ids,
                'tokens': tokens,
                'attention_mask': attention_mask,
                'embedding': embedding.tolist(),
                'embedding_norm': float(embedding_norm),
                'embedding_dimension': len(embedding)
            })
        
        return {
            'model_name': model_name,
            'success': True,
            'results': results
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return {
            'model_name': model_name,
            'success': False,
            'error': str(e)
        }

def compare_embeddings_between_texts(results, model_name):
    """Compare embeddings between texts within the same model"""
    print(f"\n=== {model_name} - Inter-text comparison ===")
    
    embeddings = [np.array(r['embedding']) for r in results]
    texts = [r['text'] for r in results]
    
    # Pairwise comparison
    for i in range(len(embeddings)):
        for j in range(i+1, len(embeddings)):
            cosine_sim = cosine_similarity(embeddings[i], embeddings[j])
            euclidean_dist = norm(embeddings[i] - embeddings[j])
            
            print(f"'{texts[i]}' vs '{texts[j]}':")
            print(f"  Cosine similarity: {cosine_sim:.6f}")
            print(f"  Euclidean distance: {euclidean_dist:.6f}")

def compare_token_ids_between_models(py_results, js_results):
    """Compare Token IDs between models"""
    print(f"\n=== Token IDs comparison (Python vs JavaScript) ===")
    
    for i, (py_result, js_result) in enumerate(zip(py_results, js_results)):
        text = py_result['text']
        py_tokens = py_result['token_ids']
        js_tokens = js_result['token_ids']
        
        print(f"\nText {i+1}: '{text}'")
        print(f"Python Token IDs:     {py_tokens}")
        print(f"JavaScript Token IDs: {js_tokens}")
        
        # Token IDs consistency
        if py_tokens == js_tokens:
            print(f"✅ Token IDs match")
        else:
            print(f"❌ Token IDs mismatch")
            print(f"   Length: Python={len(py_tokens)}, JavaScript={len(js_tokens)}")
            
            # Detailed differences
            max_len = max(len(py_tokens), len(js_tokens))
            differences = []
            for pos in range(max_len):
                py_id = py_tokens[pos] if pos < len(py_tokens) else None
                js_id = js_tokens[pos] if pos < len(js_tokens) else None
                if py_id != js_id:
                    differences.append((pos, py_id, js_id))
            
            if differences:
                print(f"   Difference positions: {len(differences)} locations")
                for pos, py_id, js_id in differences[:5]:  # Show only first 5
                    print(f"     Position {pos}: Python={py_id}, JavaScript={js_id}")

def compare_embeddings_between_models(py_results, js_results):
    """Compare embeddings between models"""
    print(f"\n=== Embedding comparison (Python vs JavaScript) ===")
    
    for i, (py_result, js_result) in enumerate(zip(py_results, js_results)):
        text = py_result['text']
        py_embedding = np.array(py_result['embedding'])
        js_embedding = np.array(js_result['embedding'])
        
        print(f"\nText {i+1}: '{text}'")
        print(f"Python Embedding L2 norm:     {py_result['embedding_norm']:.6f}")
        print(f"JavaScript Embedding L2 norm: {js_result['embedding_norm']:.6f}")
        
        # Dimension consistency
        if py_embedding.shape == js_embedding.shape:
            print(f"✅ Dimensions match: {py_embedding.shape}")
            
            # Cosine similarity
            cosine_sim = cosine_similarity(py_embedding, js_embedding)
            print(f"Cosine similarity: {cosine_sim:.6f}")
            
            # Euclidean distance
            euclidean_dist = norm(py_embedding - js_embedding)
            print(f"Euclidean distance: {euclidean_dist:.6f}")
            
            # Element-level comparison (first and last 5 elements)
            print(f"Python (first 5):  {py_embedding[:5].tolist()}")
            print(f"JavaScript (first 5): {js_embedding[:5].tolist()}")
            print(f"Python (last 5):   {py_embedding[-5:].tolist()}")
            print(f"JavaScript (last 5):  {js_embedding[-5:].tolist()}")
            
            # Statistical metrics
            max_abs_diff = np.max(np.abs(py_embedding - js_embedding))
            mean_abs_diff = np.mean(np.abs(py_embedding - js_embedding))
            print(f"Maximum absolute difference: {max_abs_diff:.6f}")
            print(f"Mean absolute difference: {mean_abs_diff:.6f}")
            
        else:
            print(f"❌ Dimension mismatch: Python={py_embedding.shape}, JavaScript={js_embedding.shape}")

def main():
    print("=== Detailed embedding vector comparison test ===")
    
    # Test texts
    test_texts = [
        "グラハム数",
        "巨大数は、気の遠くなるほど大きな有限の数である。",
        "Hello World",  # English (baseline)
        "数学",  # Short Japanese
    ]
    
    print(f"Test texts:")
    for i, text in enumerate(test_texts, 1):
        print(f"  {i}. '{text}'")
    
    # Test target model (highest accuracy mpnet)
    model_name = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
    
    # Python version test
    print(f"\n{'='*60}")
    print(f"Python version test")
    print(f"{'='*60}")
    py_model_result = test_embedding_vectors(model_name, test_texts)
    
    if py_model_result['success']:
        compare_embeddings_between_texts(py_model_result['results'], f"Python {model_name}")
    
    # Save results to JSON file
    output_file = os.path.join(os.path.dirname(__file__), "embedding_vectors_python.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_texts': test_texts,
            'model_result': py_model_result
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\nPython results saved: {output_file}")

if __name__ == '__main__':
    main()