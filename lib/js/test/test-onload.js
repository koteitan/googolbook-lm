// テスト: ページ読み込み時のhandleOnLoad関数
// test-setting.ymlの設定を使用してelements構造体をモック

// Node.js環境用のインポート
import yaml from 'js-yaml';
import fs from 'fs';

// rag-common.jsはブラウザ専用なので、テスト用に主要関数をモック
const handleOnLoad = async function(currentSite, test_elements) {
    console.log(`[Mock handleOnLoad] サイト: ${currentSite}`);
    
    // 設定読み込みのシミュレート
    test_elements.loadingStatus.setTextContent('設定を読み込み中...');
    
    // UI初期化のシミュレート
    test_elements.baseUrl.setValue(test_elements.baseUrl.value || 'https://api.openai.com/v1');
    test_elements.modelSelect.setValue(test_elements.modelSelect.value || 'gpt-4');
    
    // localStorageからの設定復元シミュレート
    const savedApiKey = test_elements.localStorage.getItem('apiKey');
    if (savedApiKey) {
        test_elements.apiKey.setValue(savedApiKey);
    }
    
    const savedQuery = test_elements.localStorage.getItem('lastQuery');
    if (savedQuery) {
        test_elements.promptWindow.setValue(savedQuery);
    }
    
    // 設定完了
    test_elements.loadingStatus.setTextContent('設定読み込み完了');
    console.log('[Mock handleOnLoad] 完了');
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
        storage: {},
        apiCalls: []
    };

    const mockElement = (id, type = 'input') => ({
        id: id,
        value: testSettings.ui_values[id] || '',
        innerHTML: '',
        style: {},
        className: '',
        disabled: false,
        placeholder: '',
        
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
            console.log(`[${id}] disabled設定: ${disabled}`);
        },
        
        setPlaceholder: function(placeholder) {
            this.placeholder = placeholder;
            console.log(`[${id}] placeholder設定: ${placeholder}`);
        }
    });

    const test_elements = {
        // UI要素
        baseUrl: mockElement('baseUrl'),
        apiKey: mockElement('apiKey'),
        modelSelect: mockElement('modelSelect'),
        promptWindow: mockElement('promptWindow'),
        loadDataBtn: mockElement('loadDataBtn', 'button'),
        sendBtn: mockElement('sendBtn', 'button'),
        responseWindow: mockElement('responseWindow', 'div'),
        ragWindow: mockElement('ragWindow', 'div'),
        errorMessages: mockElement('errorMessages', 'div'),
        loadingStatus: mockElement('loadingStatus', 'div'),
        loadingProgress: mockElement('loadingProgress', 'div'),
        debugSection: mockElement('debugSection', 'div'),
        debugInfoContent: mockElement('debugInfoContent', 'div'),
        systemPromptContent: mockElement('systemPromptContent', 'pre'),
        userQueryContent: mockElement('userQueryContent', 'pre'),
        apiConfigForm: mockElement('apiConfigForm', 'form'),
        apiKeyHelp: mockElement('apiKeyHelp', 'div'),
        licenseLink: mockElement('licenseLink', 'a'),
        fetchDate: mockElement('fetchDate', 'span'),

        // ブラウザオブジェクト
        window: {
            location: {
                hostname: 'localhost',
                origin: 'http://localhost:3000'
            },
            lastDocumentSelection: null,
            MathJax: {
                typesetPromise: () => Promise.resolve()
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
            },
            
            removeItem: function(key) {
                delete outputTracker.storage[key];
                console.log(`[localStorage] removeItem: ${key}`);
            }
        }
    };

    // 初期値設定
    test_elements.baseUrl.setValue(testSettings.ui_values.baseUrl);
    test_elements.apiKey.setValue(testSettings.ui_values.apiKey);
    test_elements.modelSelect.setValue(testSettings.ui_values.modelSelect);
    test_elements.promptWindow.setValue(testSettings.ui_values.promptWindow);

    return { test_elements, outputTracker };
}

// テスト実行
async function runHandleOnLoadTest() {
    console.log('=== handleOnLoad関数テスト開始 ===');
    
    const { test_elements, outputTracker } = createTestElements();
    const currentSite = testSettings.initial_settings.currentSite;
    
    console.log(`\n現在サイト: ${currentSite}`);
    console.log('初期UI状態:');
    console.log(`- baseUrl: ${test_elements.baseUrl.value}`);
    console.log(`- apiKey: ${test_elements.apiKey.value}`);
    console.log(`- modelSelect: ${test_elements.modelSelect.value}`);
    console.log(`- promptWindow: ${test_elements.promptWindow.value}`);
    
    console.log('\n--- handleOnLoad実行 ---');
    
    try {
        await handleOnLoad(currentSite, test_elements);
        console.log('\n✅ handleOnLoad正常完了');
    } catch (error) {
        console.error('\n❌ handleOnLoadエラー:', error.message);
    }
    
    // 結果出力
    console.log('\n=== テスト結果 ===');
    console.log('\n📝 値の変更:');
    Object.entries(outputTracker.values).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
    
    console.log('\n🎨 innerHTML変更:');
    Object.entries(outputTracker.innerHTML).forEach(([key, content]) => {
        console.log(`  ${key}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
    
    console.log('\n💾 localStorage操作:');
    Object.entries(outputTracker.storage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
    
    console.log('\n=== テスト完了 ===');
    
    return outputTracker;
}

// Node.js環境での実行
if (import.meta.url === `file://${process.argv[1]}`) {
    runHandleOnLoadTest().catch(console.error);
}

export { runHandleOnLoadTest, createTestElements };