#!/usr/bin/env python3
"""
多言語対応embeddingモデルでのテスト
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
    """指定されたモデルでテキストを処理"""
    print(f"\n=== モデル: {model_name} ===")
    print(f"テキスト: '{text}'")
    
    try:
        # SentenceTransformerでのテスト
        print(f"\n--- SentenceTransformer ---")
        sentence_model = SentenceTransformer(model_name)
        embedding = sentence_model.encode(text, convert_to_numpy=True)
        print(f"✅ 成功 - Embedding shape: {embedding.shape}")
        print(f"   Embedding (first 5): {embedding[:5].tolist()}")
        
        # Tokenizerの詳細確認
        print(f"\n--- Tokenizer詳細 ---")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        inputs = tokenizer(text, return_tensors='pt')
        
        print(f"Token IDs: {inputs['input_ids'].tolist()[0]}")
        tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
        print(f"Tokens: {tokens}")
        
        # [UNK]の数をチェック
        unk_count = tokens.count('[UNK]')
        print(f"[UNK]トークン数: {unk_count}")
        
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
        print(f"❌ エラー: {e}")
        return {
            'model_name': model_name,
            'success': False,
            'error': str(e)
        }

def main():
    print("=== 多言語対応Embeddingモデルテスト ===")
    
    # テストテキスト
    test_text = "グラハム数"
    
    # テスト対象モデル
    models_to_test = [
        # 元のモデル（比較用）
        'sentence-transformers/all-MiniLM-L6-v2',
        
        # 多言語対応モデル
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        'sentence-transformers/distiluse-base-multilingual-cased',
        'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
        
        # 日本語特化モデル（もし利用可能なら）
        'sentence-transformers/stsb-xlm-r-multilingual',
    ]
    
    results = []
    
    for model_name in models_to_test:
        try:
            result = test_model(model_name, test_text)
            results.append(result)
            
            if result['success']:
                print(f"✅ {model_name}: 成功 ([UNK]: {result['unk_count']}個)")
            else:
                print(f"❌ {model_name}: 失敗")
                
        except Exception as e:
            print(f"❌ {model_name}: スキップ - {e}")
            results.append({
                'model_name': model_name,
                'success': False,
                'error': str(e)
            })
    
    # 結果の比較
    print(f"\n=== 結果比較 ===")
    successful_results = [r for r in results if r['success']]
    
    print(f"成功したモデル数: {len(successful_results)}/{len(models_to_test)}")
    
    if len(successful_results) >= 2:
        print(f"\n--- [UNK]トークン数比較 ---")
        for result in successful_results:
            status = "🟢 良好" if result['unk_count'] == 0 else f"🔴 {result['unk_count']}個"
            print(f"  {result['model_name']}: {status}")
        
        # 最もUNKが少ないモデルを推奨
        best_models = [r for r in successful_results if r['unk_count'] == 0]
        if best_models:
            print(f"\n🎯 推奨モデル ([UNK]なし):")
            for model in best_models:
                print(f"  - {model['model_name']}")
                print(f"    次元: {model['embedding_dimension']}")
                print(f"    トークン数: {len(model['tokens'])}")
        else:
            min_unk = min(r['unk_count'] for r in successful_results)
            best_models = [r for r in successful_results if r['unk_count'] == min_unk]
            print(f"\n🔶 相対的に良いモデル ([UNK]: {min_unk}個):")
            for model in best_models:
                print(f"  - {model['model_name']}")
                print(f"    次元: {model['embedding_dimension']}")
    
    # 結果をJSONファイルに保存
    output_file = os.path.join(os.path.dirname(__file__), "multilingual_test_results.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n詳細結果を保存しました: {output_file}")

if __name__ == '__main__':
    main()