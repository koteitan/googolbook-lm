#!/usr/bin/env python3
"""
Token化の詳細分析 - 区切り位置と文字レベルマッピング
"""

import sys
import os
import json

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from transformers import AutoTokenizer

def analyze_character_to_token_mapping(text, tokenizer):
    """文字レベルでのToken化分析"""
    print(f"\n=== 文字レベルToken化分析 ===")
    print(f"元テキスト: '{text}'")
    print(f"文字数: {len(text)}")
    
    # Tokenization
    inputs = tokenizer(text, return_tensors='pt', padding=True, truncation=True)
    token_ids = inputs['input_ids'].tolist()[0]
    tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
    
    print(f"\nToken IDs: {token_ids}")
    print(f"Tokens: {tokens}")
    print(f"Token数: {len(tokens)}")
    
    # 特殊トークンを除いたコンテンツトークンのみ抽出
    content_tokens = []
    content_token_ids = []
    
    for i, (token_id, token) in enumerate(zip(token_ids, tokens)):
        # 特殊トークン（<s>, </s>, ▁など）をスキップ
        if token not in ['<s>', '</s>', '<pad>', '<unk>', '<mask>']:
            content_tokens.append(token)
            content_token_ids.append(token_id)
    
    print(f"\nコンテンツトークン: {content_tokens}")
    print(f"コンテンツToken IDs: {content_token_ids}")
    
    # 文字とトークンの対応関係を分析
    print(f"\n=== 文字とTokenの対応関係 ===")
    
    # デコードして文字位置を特定
    decoded_text = tokenizer.decode(token_ids, skip_special_tokens=True)
    print(f"デコード結果: '{decoded_text}'")
    
    # 個別トークンのデコード
    print(f"\n=== 個別Token分析 ===")
    char_position = 0
    
    for i, (token_id, token) in enumerate(zip(token_ids, tokens)):
        if token in ['<s>', '</s>']:
            print(f"Token {i:2d}: '{token}' (ID: {token_id}) → 特殊トークン")
            continue
            
        # 個別デコード
        individual_decoded = tokenizer.decode([token_id], skip_special_tokens=True)
        print(f"Token {i:2d}: '{token}' (ID: {token_id}) → デコード: '{individual_decoded}'")
        
        # 文字位置の推定
        if individual_decoded in text:
            position = text.find(individual_decoded, char_position)
            if position != -1:
                print(f"         文字位置: {position}-{position + len(individual_decoded)} ('{text[position:position + len(individual_decoded)]}')")
                char_position = position + len(individual_decoded)
    
    return {
        'original_text': text,
        'token_ids': token_ids,
        'tokens': tokens,
        'content_tokens': content_tokens,
        'decoded_text': decoded_text
    }

def analyze_morphological_boundaries(text, tokenizer):
    """形態素境界の分析"""
    print(f"\n=== 形態素境界分析 ===")
    
    # MeCab参考結果
    try:
        import MeCab
        mecab = MeCab.Tagger("-Owakati")
        mecab_result = mecab.parse(text).strip()
        mecab_words = mecab_result.split()
        print(f"MeCab形態素解析: {mecab_words}")
    except:
        print(f"MeCab利用不可")
        mecab_words = []
    
    # Tokenizerの結果
    inputs = tokenizer(text, return_tensors='pt')
    tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
    
    # 特殊トークンを除去
    content_tokens = [t for t in tokens if t not in ['<s>', '</s>', '<pad>', '<unk>', '<mask>']]
    
    # ▁（スペース記号）の処理
    processed_tokens = []
    for token in content_tokens:
        if token.startswith('▁'):
            # ▁を除去して実際の文字列を取得
            processed_tokens.append(token[1:] if len(token) > 1 else '')
        elif token == '▁':
            # 純粋なスペーストークン
            processed_tokens.append('[SPACE]')
        else:
            processed_tokens.append(token)
    
    # 空文字列を除去
    processed_tokens = [t for t in processed_tokens if t]
    
    print(f"Tokenizer結果: {processed_tokens}")
    
    # 境界の比較
    print(f"\n=== 境界比較 ===")
    print(f"MeCab境界数: {len(mecab_words) - 1 if mecab_words else 0}")
    print(f"Tokenizer境界数: {len(processed_tokens) - 1}")
    
    if mecab_words:
        print(f"\nMeCab単語:")
        for i, word in enumerate(mecab_words):
            print(f"  {i+1:2d}. '{word}'")
    
    print(f"\nTokenizer単語:")
    for i, token in enumerate(processed_tokens):
        print(f"  {i+1:2d}. '{token}'")
    
    # 一致分析
    if mecab_words:
        print(f"\n=== 一致分析 ===")
        mecab_text = ''.join(mecab_words)
        tokenizer_text = ''.join(processed_tokens)
        
        print(f"MeCab再結合: '{mecab_text}'")
        print(f"Tokenizer再結合: '{tokenizer_text}'")
        print(f"元テキスト: '{text}'")
        
        if mecab_text == text and tokenizer_text == text:
            print("✅ 両方とも元テキストと一致")
        elif tokenizer_text == text:
            print("✅ Tokenizerのみ元テキストと一致")
        elif mecab_text == text:
            print("✅ MeCabのみ元テキストと一致")
        else:
            print("❌ いずれも元テキストと不一致")

def main():
    print("=== Token化詳細分析 ===")
    
    # テストテキスト
    test_text = "巨大数は、気の遠くなるほど大きな有限の数である。"
    
    # 多言語モデルのTokenizer
    model_name = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    
    print(f"モデル: {model_name}")
    print(f"テストテキスト: '{test_text}'")
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # 文字レベル分析
        char_analysis = analyze_character_to_token_mapping(test_text, tokenizer)
        
        # 形態素境界分析
        analyze_morphological_boundaries(test_text, tokenizer)
        
        # 結果保存
        output_file = os.path.join(os.path.dirname(__file__), "tokenization_analysis.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(char_analysis, f, ensure_ascii=False, indent=2)
        
        print(f"\n分析結果を保存しました: {output_file}")
        
    except Exception as e:
        print(f"エラー: {e}")

if __name__ == '__main__':
    main()