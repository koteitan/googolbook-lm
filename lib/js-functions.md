# lib/rag-common.js Function Call Graph

## イベントハンドラ

### 1. ページ読み込み(window.onload)
- `initializeRAG(currentSite)`

### 2. Load Dataボタン押下(button.click)
- `loadVectorStore()`

### 3. Sendボタン押下 / Ctrl+Enter(button.click / keydown)
- `handleSend()`

## インターフェース

### 値の取得

UI要素やブラウザオブジェクトから値を取得する関数:

- **elements.baseUrl(textbox, APIベースURL)**
  - `checkAndShowErrors()` - 値を取得してエラーチェック
  - `extractSearchKeywords(query, apiKey, elements)` - 値を取得してLLM APIに送信
  - `generateAIResponse()` - 値を取得してLLM APIに送信
  - `saveSettingsToLocalStorage()` - 値を取得してlocalStorageに保存

- **elements.apiKey(textbox, APIキー)**
  - `checkAndShowErrors()` - 値を取得してエラーチェック
  - `processSearchAndResponse()` - 値を取得してAPIキーとして使用

- **elements.modelSelect(select, LLMモデル)**
  - `getCurrentModel(elements)` - 現在選択されているモデルを取得
  - `extractSearchKeywords(query, apiKey, elements)` - 値を取得してLLM APIに送信
  - `saveSettingsToLocalStorage()` - 値を取得してlocalStorageに保存

- **elements.promptWindow(textarea, 質問入力欄)**
  - `handleSend()` - 質問文を取得

- **elements.localStorage(storage, ローカルストレージ)**
  - `loadSettingsFromLocalStorage()` - 保存された設定を取得
  - `initializeRAG()` - 最後のクエリを取得

- **elements.window.location(location, ウィンドウ位置情報)**
  - `checkAndShowErrors()` - ホスト名を取得してローカルアクセス判定

- **elements.window.lastDocumentSelection(object, ドキュメント選択情報)**
  - `getRepresentativeContentFromChunks()` - 最後の文書選択情報を取得

### 値の変更

UI要素やブラウザオブジェクトの値を変更・設定する関数:

- **elements.baseUrl(textbox, APIベースURL)**
  - `loadSettingsFromLocalStorage()` - localStorageから読み込んで値を設定
  - `initializeRAG()` - 初期値を設定
  - `updateUIForProvider()` - プロバイダーに応じて値とplaceholderを更新

- **elements.apiKey(textbox, APIキー)**
  - `updateUIForProvider()` - placeholderを更新

- **elements.apiKeyHelp(div, APIキーヘルプ)**
  - `updateUIForProvider()` - ヘルプテキストを表示

- **elements.debugInfoContent(div, デバッグ情報コンテンツ)**
  - `displayLLMPrompt(systemPrompt, userQuery, elements, ...)` - デバッグ情報を表示

- **elements.debugSection(div, デバッグセクション)**
  - `displayLLMPrompt(systemPrompt, userQuery, elements, ...)` - 表示制御

- **elements.errorMessages(div, エラーメッセージ)**
  - `showErrorMessages()` - エラーメッセージを表示
  - `clearErrorMessages()` - エラーメッセージをクリア

- **elements.fetchDate(span, 取得日時)**
  - `updateLicenseInfo(config, elements)` - 取得日時を表示

- **elements.licenseLink(a, ライセンスリンク)**
  - `updateLicenseInfo(config, elements)` - ライセンス情報を表示

- **elements.modelSelect(select, LLMモデル)**
  - `loadSettingsFromLocalStorage()` - localStorageから読み込んで値を設定
  - `initializeRAG()` - 初期値を設定

- **elements.loadDataBtn(button, データ読み込みボタン)**
  - `loadVectorStore()` - ボタンを無効化

- **elements.loadingProgress(div, 読み込み進捗)**
  - `loadVectorStore()` - CSSクラスとスタイルを制御

- **elements.loadingStatus(div, 読み込み状態)**
  - `loadVectorStore()` - ステータステキストを表示
  - `initializeRAG()` - ステータステキストを表示

- **elements.promptWindow(textarea, 質問入力欄)**
  - `handleSend()` - 無効化
  - `processSearchAndResponse()` - 無効化解除
  - `initializeRAG()` - 値を復元

- **elements.ragWindow(div, RAG検索結果表示)**
  - `handleSend()` - RAG検索結果を表示
  - `processSearchAndResponse()` - RAG検索結果を表示
  - `displayRAGResults()` - RAG検索結果を表示

- **elements.responseWindow(div, 応答表示)**
  - `handleSend()` - AI応答を表示
  - `processSearchAndResponse()` - AI応答を表示
  - `generateAIResponse()` - AI応答を表示

- **elements.sendBtn(button, 送信ボタン)**
  - `checkAndShowErrors()` - 無効化制御
  - `handleSend()` - 無効化

- **elements.systemPromptContent(pre, システムプロンプト内容)**
  - `displayLLMPrompt(systemPrompt, userQuery, elements, ...)` - システムプロンプトを表示

- **elements.userQueryContent(pre, ユーザークエリ内容)**
  - `displayLLMPrompt(systemPrompt, userQuery, elements, ...)` - ユーザークエリを表示

- **elements.localStorage(storage, ローカルストレージ)**
  - `saveSettingsToLocalStorage()` - 設定を保存
  - `handleSend()` - 最後のクエリを保存

- **elements.window.location(location, ウィンドウ位置情報)**
  - `callLLMAPI()` - リファラーヘッダーにオリジンを設定

- **elements.window.lastDocumentSelection(object, ドキュメント選択情報)**
  - `findOptimalDocumentNumbers()` - 文書選択情報を保存

- **elements.window.MathJax(object, 数式レンダリング)**
  - `generateAIResponse()` - 数式のタイプセットを実行

- **elements.document(document, ドキュメント)**
  - `initializeRAG()` - 全てのUI要素を取得

## Function Call Graph (Mermaid)

### 1. ページ読み込み時
```mermaid
graph TD
    initializeRAG["initializeRAG()"]
    
    initializeRAG --> loadConfig["loadConfig()"]
    initializeRAG --> loadSettingsFromLocalStorage["loadSettingsFromLocalStorage()"]
    initializeRAG --> checkAndShowErrors["checkAndShowErrors()"]
    
    loadConfig --> updateLicenseInfo["updateLicenseInfo()"]
    loadSettingsFromLocalStorage --> updateUIForProvider["updateUIForProvider()"]
    checkAndShowErrors --> showErrorMessages["showErrorMessages()"]
    updateUIForProvider --> getProviderFromModel["getProviderFromModel()"]
    
    classDef entry fill:none,stroke:#333,stroke-width:4px
    classDef ui fill:none,stroke:#333,stroke-width:2px
    classDef util fill:none,stroke:#333,stroke-width:2px
    
    class initializeRAG entry
    class showErrorMessages,updateUIForProvider ui
    class loadConfig,loadSettingsFromLocalStorage,updateLicenseInfo,getProviderFromModel util
```

### 2. Load Dataボタン押下時
```mermaid
graph TD
    loadVectorStore["loadVectorStore()"]
    
    loadVectorStore --> loadCompressedJSONL["loadCompressedJSONL()"]
    loadVectorStore --> base64ToFloat32Array["base64ToFloat32Array()"]
    loadVectorStore --> checkAndShowErrors["checkAndShowErrors()"]
    
    loadCompressedJSONL --> getPageFromXML["getPageFromXML()"]
    checkAndShowErrors --> showErrorMessages["showErrorMessages()"]
    
    classDef entry fill:none,stroke:#333,stroke-width:4px
    classDef ui fill:none,stroke:#333,stroke-width:2px
    classDef data fill:none,stroke:#333,stroke-width:2px
    
    class loadVectorStore entry
    class showErrorMessages ui
    class loadCompressedJSONL,base64ToFloat32Array,getPageFromXML,checkAndShowErrors data
```

### 3. Sendボタン押下時
```mermaid
graph TD
    handleSend["handleSend()"]
    
    handleSend --> processSearchAndResponse["processSearchAndResponse()"]
    handleSend --> checkAndShowErrors["checkAndShowErrors()"]
    
    processSearchAndResponse --> extractSearchKeywords["extractSearchKeywords()"]
    processSearchAndResponse --> performMultiKeywordSearch["performMultiKeywordSearch()"]
    processSearchAndResponse --> findOptimalDocumentNumbers["findOptimalDocumentNumbers()"]
    processSearchAndResponse --> displayRAGResults["displayRAGResults()"]
    processSearchAndResponse --> generateAIResponse["generateAIResponse()"]
    processSearchAndResponse --> displayLLMPrompt["displayLLMPrompt()"]
    
    extractSearchKeywords --> callLLMAPI["callLLMAPI()"]
    performMultiKeywordSearch --> cosineSimilarity["cosineSimilarity()"]
    findOptimalDocumentNumbers --> calculateRequiredTokens["calculateRequiredTokens()"]
    generateAIResponse --> getCurrentModel["getCurrentModel()"]
    generateAIResponse --> getPromptSizeLimit["getPromptSizeLimit()"]
    generateAIResponse --> processSearchResultContent["processSearchResultContent()"]
    generateAIResponse --> callLLMAPI
    
    callLLMAPI --> getProviderFromModel["getProviderFromModel()"]
    callLLMAPI --> callOpenAIAPI["callOpenAIAPI()"]
    callLLMAPI --> callClaudeAPI["callClaudeAPI()"]
    callLLMAPI --> callGeminiAPI["callGeminiAPI()"]
    callLLMAPI --> callOpenRouterAPI["callOpenRouterAPI()"]
    callLLMAPI --> callAzureOpenAIAPI["callAzureOpenAIAPI()"]
    
    checkAndShowErrors --> showErrorMessages["showErrorMessages()"]
    
    classDef entry fill:none,stroke:#333,stroke-width:4px
    classDef api fill:none,stroke:#333,stroke-width:2px
    classDef ui fill:none,stroke:#333,stroke-width:2px
    classDef search fill:none,stroke:#333,stroke-width:2px
    
    class handleSend entry
    class callLLMAPI,callOpenAIAPI,callClaudeAPI,callGeminiAPI,callOpenRouterAPI,callAzureOpenAIAPI api
    class showErrorMessages,displayRAGResults,displayLLMPrompt ui
    class processSearchAndResponse,extractSearchKeywords,performMultiKeywordSearch,findOptimalDocumentNumbers,generateAIResponse,cosineSimilarity,calculateRequiredTokens,getCurrentModel,getPromptSizeLimit,processSearchResultContent,getProviderFromModel,checkAndShowErrors search
```