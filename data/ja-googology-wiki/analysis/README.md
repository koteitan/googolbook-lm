# 巨大数研究 Wiki 分析結果

このディレクトリには、巨大数研究 Wiki（日本語版）の分析結果が含まれています。

## 分析レポート

### 📊 [namespaces.md](namespaces.md)
Wiki の名前空間別コンテンツ分布の分析結果です。各名前空間のページ数、サイズ、除外後の統計情報が含まれています。

### 👥 [contributors.md](contributors.md)
Wiki の貢献者別ページ作成数の分析結果です。上位貢献者のランキングと作成ページの例が含まれています。

### 🎲 [random.html](random.html)
ランダムページセレクターです。ブラウザで開くと、除外ルールが正しく動作しているかを確認できるランダムページサンプルが表示されます。

### 🔢 [tokens.md](tokens.md)
Wiki コンテンツのトークン数分析結果です。OpenAI GPT-4 トークナイザーを使用した文字数とトークン数の統計が含まれています。

## データについて

- **データソース**: 巨大数研究 Wiki (googology.fandom.com/ja)
- **ライセンス**: CC BY-SA 3.0
- **分析対象**: MediaWiki XML エクスポート
- **除外ルール**: サイト設定で定義された名前空間とユーザー名が除外されています

## 更新

これらのファイルは対応する分析ツールによって自動生成されます：
- `tools/namespaces/namespaces.py`
- `tools/contributors/contributors.py`
- `tools/random/random-check.py`
- `tools/tokens/tokens.py`