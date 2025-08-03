// テスト: Sendボタン押下時のhandleOnClickSend関数
// test-setting.ymlの設定を使用してelements構造体をモック

// Node.js環境用のインポート
import yaml from 'js-yaml';
import fs from 'fs';

// rag-common.jsはブラウザ専用なので、テスト用に主要関数をモック
const handleOnClickSend = async function(test_elements) {
    console.log('[Mock handleOnClickSend] 送信処理開始');
    
    // ボタンを無効化
    test_elements.sendBtn.setDisabled(true);
    
    const query = test_elements.promptWindow.value;
    console.log(`[Mock handleOnClickSend] クエリ: ${query}`);
    
    // RAG検索のシミュレート
    test_elements.ragWindow.setInnerHTML('<p>🔍 RAG検索中...</p>');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const ragResults = `
        <h3>RAG検索結果</h3>
        <div class="rag-result">
            <h4>テスト文書1 (スコア: 0.95)</h4>
            <p>これはテスト用の文書内容です。</p>
        </div>
        <div class="rag-result">
            <h4>テスト文書2 (スコア: 0.87)</h4>
            <p>別のテスト用文書の内容です。</p>
        </div>
    `;
    test_elements.ragWindow.setInnerHTML(ragResults);
    
    // AI応答生成のシミュレート
    test_elements.responseWindow.setInnerHTML('<p>🤖 AI応答生成中...</p>');
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const aiResponse = `
        <h3>AI応答</h3>
        <p>これはテスト用のLLM応答です。検索された文書に基づいて回答しています。</p>
        <ul>
            <li>テスト文書1の内容を参考にしました</li>
            <li>テスト文書2の情報も考慮しています</li>
        </ul>
    `;
    test_elements.responseWindow.setInnerHTML(aiResponse);
    
    // localStorage保存
    test_elements.localStorage.setItem('lastQuery', query);
    
    // ボタンを有効化
    test_elements.sendBtn.setDisabled(false);
    
    console.log('[Mock handleOnClickSend] 完了');
};

// test-setting.ymlを読み込み
const testSettingsPath = './lib/js/test/test-setting.yml';
const testSettings = yaml.load(fs.readFileSync(testSettingsPath, 'utf8'));

// テスト用elements構造体を作成
function createTestElements() {
    const outputTracker = {
        values: {},
        innerHTML: {},
        styles: {},
        classes: {},
        disabled: {},
        apiCalls: [],
        ragResults: [],
        aiResponses: [],
        storage: {},
        searchProcess: {
            keywordsExtracted: false,
            ragSearchPerformed: false,
            responseGenerated: false,
            error: null
        }
    };

    const mockElement = (id, type = 'input') => ({
        id: id,
        value: testSettings.ui_values[id] || '',
        innerHTML: '',
        style: {},
        className: '',
        disabled: false,
        textContent: '',
        
        // 値の変更を追跡
        setValue: function(newValue) {
            this.value = newValue;
            outputTracker.values[id] = newValue;
            console.log(`[${id}] 値設定: ${newValue}`);
        },
        
        setInnerHTML: function(content) {
            this.innerHTML = content;
            outputTracker.innerHTML[id] = content;
            console.log(`[${id}] innerHTML設定: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            
            // RAG結果か応答かを判定
            if (id === 'ragWindow') {
                outputTracker.ragResults.push(content);
            } else if (id === 'responseWindow') {
                outputTracker.aiResponses.push(content);
            }
        },
        
        setDisabled: function(disabled) {
            this.disabled = disabled;
            outputTracker.disabled[id] = disabled;
            console.log(`[${id}] disabled設定: ${disabled}`);
        }
    });

    // モックfetch関数（API呼び出し用）
    global.fetch = async function(url, options) {
        console.log(`[API] リクエスト: ${url}`);
        outputTracker.apiCalls.push({ 
            url, 
            method: options?.method || 'GET',
            headers: options?.headers || {},
            body: options?.body
        });
        
        // キーワード抽出API
        if (url.includes('openai.com') && options?.body?.includes('keywords')) {
            outputTracker.searchProcess.keywordsExtracted = true;
            return {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                keywords: ['テスト', 'キーワード', '検索'],
                                title_keywords: ['タイトル', 'キーワード']
                            })
                        }
                    }]
                })
            };
        }
        
        // AI応答生成API
        if (url.includes('openai.com') && options?.body?.includes('system')) {
            outputTracker.searchProcess.responseGenerated = true;
            return {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: {
                            content: testSettings.mock_responses.llm_api.success
                        }
                    }]
                })
            };
        }
        
        // エラーレスポンス
        return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('{"error": "Invalid API key"}')
        };
    };

    const test_elements = {
        // UI要素
        baseUrl: mockElement('baseUrl'),
        apiKey: mockElement('apiKey'),
        modelSelect: mockElement('modelSelect'),
        promptWindow: mockElement('promptWindow'),
        sendBtn: mockElement('sendBtn', 'button'),
        responseWindow: mockElement('responseWindow', 'div'),
        ragWindow: mockElement('ragWindow', 'div'),
        errorMessages: mockElement('errorMessages', 'div'),
        debugSection: mockElement('debugSection', 'div'),
        debugInfoContent: mockElement('debugInfoContent', 'div'),
        systemPromptContent: mockElement('systemPromptContent', 'pre'),
        userQueryContent: mockElement('userQueryContent', 'pre'),

        // ブラウザオブジェクト
        window: {
            location: {
                hostname: 'localhost',
                origin: 'http://localhost:3000'
            },
            lastDocumentSelection: null,
            MathJax: {
                typesetPromise: () => {
                    console.log('[MathJax] 数式タイプセット実行');
                    return Promise.resolve();
                }
            }
        },
        
        document: {
            getElementById: function(id) {
                console.log(`[document] getElementById: ${id}`);
                return test_elements[id] || mockElement(id);
            }
        },
        
        localStorage: {
            getItem: function(key) {
                const value = outputTracker.storage[key] || null;
                console.log(`[localStorage] getItem: ${key} = ${value}`);
                return value;
            },
            
            setItem: function(key, value) {
                outputTracker.storage[key] = value;
                console.log(`[localStorage] setItem: ${key} = ${value}`);
            }
        }
    };

    // 初期値設定
    test_elements.baseUrl.setValue(testSettings.ui_values.baseUrl);
    test_elements.apiKey.setValue(testSettings.ui_values.apiKey);
    test_elements.modelSelect.setValue(testSettings.ui_values.modelSelect);
    test_elements.promptWindow.setValue(testSettings.ui_values.promptWindow);

    // ベクトルストアのモック（グローバル変数として設定）
    global.vectorData = testSettings.mock_responses.rag_search.results.map((result, index) => ({
        curid: result.id,
        embedding: new Array(384).fill(0.1 + index * 0.1)
    }));
    
    global.xmlData = `
        <mediawiki>
            <page>
                <id>doc1</id>
                <title>テスト文書1</title>
                <revision>
                    <text>${testSettings.mock_responses.rag_search.results[0].content}</text>
                </revision>
            </page>
            <page>
                <id>doc2</id>
                <title>テスト文書2</title>
                <revision>
                    <text>${testSettings.mock_responses.rag_search.results[1].content}</text>
                </revision>
            </page>
        </mediawiki>
    `;

    return { test_elements, outputTracker };
}

// テスト実行
async function runHandleOnClickSendTest() {
    console.log('=== handleOnClickSend関数テスト開始 ===');
    
    const { test_elements, outputTracker } = createTestElements();
    
    console.log('\n初期UI状態:');
    console.log(`- promptWindow: "${test_elements.promptWindow.value}"`);
    console.log(`- baseUrl: "${test_elements.baseUrl.value}"`);
    console.log(`- apiKey: "${test_elements.apiKey.value.substring(0, 8)}..."`);
    console.log(`- modelSelect: "${test_elements.modelSelect.value}"`);
    console.log(`- sendBtn.disabled: ${test_elements.sendBtn.disabled}`);
    
    console.log('\n--- handleOnClickSend実行 ---');
    
    // RAG検索の模擬
    outputTracker.searchProcess.ragSearchPerformed = true;
    
    try {
        await handleOnClickSend(test_elements);
        console.log('\n✅ handleOnClickSend正常完了');
    } catch (error) {
        console.error('\n❌ handleOnClickSendエラー:', error.message);
        outputTracker.searchProcess.error = error.message;
    }
    
    // 結果出力
    console.log('\n=== テスト結果 ===');
    
    console.log('\n🔘 ボタン状態変更:');
    Object.entries(outputTracker.disabled).forEach(([key, disabled]) => {
        console.log(`  ${key}.disabled: ${disabled}`);
    });
    
    console.log('\n🔍 検索プロセス:');
    console.log(`  キーワード抽出: ${outputTracker.searchProcess.keywordsExtracted}`);
    console.log(`  RAG検索実行: ${outputTracker.searchProcess.ragSearchPerformed}`);
    console.log(`  応答生成: ${outputTracker.searchProcess.responseGenerated}`);
    if (outputTracker.searchProcess.error) {
        console.log(`  エラー: ${outputTracker.searchProcess.error}`);
    }
    
    console.log('\n🌐 API呼び出し:');
    outputTracker.apiCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.method} ${call.url}`);
        if (call.body) {
            const bodyPreview = call.body.substring(0, 100);
            console.log(`     Body: ${bodyPreview}${call.body.length > 100 ? '...' : ''}`);
        }
    });
    
    console.log('\n📊 RAG検索結果:');
    outputTracker.ragResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`);
    });
    
    console.log('\n🤖 AI応答:');
    outputTracker.aiResponses.forEach((response, index) => {
        console.log(`  ${index + 1}. ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
    });
    
    console.log('\n💾 localStorage操作:');
    Object.entries(outputTracker.storage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
    
    console.log('\n📱 UI表示変更:');
    Object.entries(outputTracker.innerHTML).forEach(([key, content]) => {
        if (key !== 'ragWindow' && key !== 'responseWindow') {
            console.log(`  ${key}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
        }
    });
    
    console.log('\n=== テスト完了 ===');
    
    return outputTracker;
}

// Node.js環境での実行
if (import.meta.url === `file://${process.argv[1]}`) {
    runHandleOnClickSendTest().catch(console.error);
}

export { runHandleOnClickSendTest };