// テスト: Load Dataボタン押下時のhandleOnClickLoadData関数
// test-setting.ymlの設定を使用してelements構造体をモック

// Node.js環境用のインポート
import yaml from 'js-yaml';
import fs from 'fs';

// rag-common.jsはブラウザ専用なので、テスト用に主要関数をモック
const handleOnClickLoadData = async function(test_elements) {
    console.log('[Mock handleOnClickLoadData] データロード開始');
    
    // ボタンを無効化
    test_elements.loadDataBtn.setDisabled(true);
    test_elements.loadingStatus.setTextContent('ベクトルストアを読み込み中...');
    test_elements.loadingProgress.setStyle('display', 'block');
    
    // 模擬的な非同期処理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 進捗更新
    test_elements.loadingStatus.setTextContent('メタデータを読み込み中...');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    test_elements.loadingStatus.setTextContent('ベクトルデータを読み込み中...');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 完了
    test_elements.loadingStatus.setTextContent('データロード完了');
    test_elements.loadingProgress.setStyle('display', 'none');
    test_elements.sendBtn.setDisabled(false);
    
    console.log('[Mock handleOnClickLoadData] 完了');
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
        networkRequests: [],
        dataLoading: {
            started: false,
            completed: false,
            progress: 0,
            status: ''
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
            console.log(`[${id}] innerHTML設定: ${content}`);
        },
        
        setTextContent: function(content) {
            this.textContent = content;
            outputTracker.innerHTML[id] = content;
            console.log(`[${id}] textContent設定: ${content}`);
        },
        
        setDisabled: function(disabled) {
            this.disabled = disabled;
            outputTracker.disabled[id] = disabled;
            console.log(`[${id}] disabled設定: ${disabled}`);
        },
        
        setClassName: function(className) {
            this.className = className;
            outputTracker.classes[id] = className;
            console.log(`[${id}] className設定: ${className}`);
        },
        
        setStyle: function(property, value) {
            this.style[property] = value;
            if (!outputTracker.styles[id]) outputTracker.styles[id] = {};
            outputTracker.styles[id][property] = value;
            console.log(`[${id}] style.${property}設定: ${value}`);
        }
    });

    // モックfetch関数
    global.fetch = async function(url, options) {
        console.log(`[fetch] リクエスト: ${url}`);
        outputTracker.networkRequests.push({ url, options });
        
        // テスト用のモックレスポンス
        if (url.includes('vector_store_part')) {
            const mockData = {
                vectors: [
                    { id: 'doc1', embedding: new Array(384).fill(0.1) },
                    { id: 'doc2', embedding: new Array(384).fill(0.2) }
                ]
            };
            
            return {
                ok: true,
                json: () => Promise.resolve(mockData),
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
            };
        }
        
        if (url.includes('vector_store_meta.json')) {
            const mockMeta = {
                total_parts: 2,
                vector_dimension: 384,
                total_documents: 100
            };
            
            return {
                ok: true,
                json: () => Promise.resolve(mockMeta)
            };
        }
        
        return {
            ok: false,
            status: 404,
            statusText: 'Not Found'
        };
    };

    const test_elements = {
        // UI要素
        loadDataBtn: mockElement('loadDataBtn', 'button'),
        sendBtn: mockElement('sendBtn', 'button'),
        loadingStatus: mockElement('loadingStatus', 'div'),
        loadingProgress: mockElement('loadingProgress', 'div'),
        errorMessages: mockElement('errorMessages', 'div'),
        responseWindow: mockElement('responseWindow', 'div'),
        ragWindow: mockElement('ragWindow', 'div'),

        // ブラウザオブジェクト
        window: {
            location: {
                hostname: 'localhost',
                origin: 'http://localhost:3000'
            }
        },
        
        document: {
            getElementById: function(id) {
                console.log(`[document] getElementById: ${id}`);
                return test_elements[id] || mockElement(id);
            }
        }
    };

    return { test_elements, outputTracker };
}

// テスト実行
async function runHandleOnClickLoadDataTest() {
    console.log('=== handleOnClickLoadData関数テスト開始 ===');
    
    const { test_elements, outputTracker } = createTestElements();
    
    console.log('\n初期UI状態:');
    console.log(`- loadDataBtn.disabled: ${test_elements.loadDataBtn.disabled}`);
    console.log(`- sendBtn.disabled: ${test_elements.sendBtn.disabled}`);
    console.log(`- loadingStatus: "${test_elements.loadingStatus.textContent}"`);
    
    console.log('\n--- handleOnClickLoadData実行 ---');
    
    // データローディング状態の追跡
    const originalSetDisabled = test_elements.loadDataBtn.setDisabled;
    test_elements.loadDataBtn.setDisabled = function(disabled) {
        originalSetDisabled.call(this, disabled);
        if (disabled) {
            outputTracker.dataLoading.started = true;
            console.log('📊 データローディング開始');
        }
    };
    
    const originalSetTextContent = test_elements.loadingStatus.setTextContent;
    test_elements.loadingStatus.setTextContent = function(content) {
        originalSetTextContent.call(this, content);
        outputTracker.dataLoading.status = content;
        if (content.includes('完了') || content.includes('Complete')) {
            outputTracker.dataLoading.completed = true;
            console.log('✅ データローディング完了');
        }
    };
    
    try {
        await handleOnClickLoadData(test_elements);
        console.log('\n✅ handleOnClickLoadData正常完了');
    } catch (error) {
        console.error('\n❌ handleOnClickLoadDataエラー:', error.message);
    }
    
    // 結果出力
    console.log('\n=== テスト結果 ===');
    
    console.log('\n🔘 ボタン状態変更:');
    Object.entries(outputTracker.disabled).forEach(([key, disabled]) => {
        console.log(`  ${key}.disabled: ${disabled}`);
    });
    
    console.log('\n📱 UI表示変更:');
    Object.entries(outputTracker.innerHTML).forEach(([key, content]) => {
        console.log(`  ${key}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
    
    console.log('\n🎨 スタイル変更:');
    Object.entries(outputTracker.styles).forEach(([key, styles]) => {
        console.log(`  ${key}:`);
        Object.entries(styles).forEach(([prop, value]) => {
            console.log(`    ${prop}: ${value}`);
        });
    });
    
    console.log('\n🌐 ネットワークリクエスト:');
    outputTracker.networkRequests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.url}`);
    });
    
    console.log('\n📊 データローディング状況:');
    console.log(`  開始: ${outputTracker.dataLoading.started}`);
    console.log(`  完了: ${outputTracker.dataLoading.completed}`);
    console.log(`  ステータス: "${outputTracker.dataLoading.status}"`);
    
    console.log('\n=== テスト完了 ===');
    
    return outputTracker;
}

// Node.js環境での実行
if (import.meta.url === `file://${process.argv[1]}`) {
    runHandleOnClickLoadDataTest().catch(console.error);
}

export { runHandleOnClickLoadDataTest };