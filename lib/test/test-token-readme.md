# test-token.js - JavaScript Tokenization Test Tool

lib/rag-common.jsと同じロジックを使用してJavaScript側のトークン化をテストするNode.jsツールです。

## 機能

- **TinySegmenter形態素解析**: 軽量な日本語分かち書き
- **設定読み込み**: config.ymlからtokenize.modeを読み込み
- **詳細トークン情報**: 文字種別と分割結果の表示

## 使用方法

```bash
# 日本語サイトでテスト（デフォルト）
echo "グラハム数" | node tools/rag/test-token.js

# 英語サイトでテスト
echo "Graham's number" | node tools/rag/test-token.js googology-wiki

# インタラクティブモード
node tools/rag/test-token.js
# テキストを入力してCtrl+D

# ファイルから読み込み
node tools/rag/test-token.js < input.txt
```

## 出力例

```
Current site: ja-googology-wiki
Tokenize mode: mecab
Embedding model: Xenova/all-MiniLM-L6-v2

Input text: "グラハム数"
============================================================

=== TinySegmenter Morphological Analyzer ===
🔤 Initializing TinySegmenter for Japanese morphological analysis...
✅ TinySegmenter initialized successfully
🔤 Tokenized: "グラハム数" → "グラハム 数"
Original text: "グラハム数"
Tokenized text: "グラハム 数"
Number of morphemes: 2

Detailed morphemes:
--------------------------------------------------
  1 | グラハム     | katakana | グラハム
  2 | 数          | kanji    | 数

=== Summary ===
Current configuration uses TinySegmenter for Japanese morphological analysis.
This matches the browser-side tokenization in rag-common.js.
```

## rag-common.jsとの対応

このツールは以下の点でrag-common.jsと同じ動作をします：

1. **同じTinySegmenter**: 同じライブラリとトークン化ロジック
2. **同じ設定読み込み**: config.ymlのtokenize.modeを使用
3. **同じ形態素解析クラス**: JapaneseMorphologicalAnalyzerクラス
4. **軽量**: 外部依存なしの純JavaScriptImplementation

## デバッグ用途

- ブラウザ側とNode.js側で同じトークン化結果が得られるか確認
- 形態素解析の動作確認
- 設定変更による影響の確認

## 依存関係

- `js-yaml`: YAML設定ファイル読み込み
- TinySegmenter: 組み込み実装（外部依存なし）