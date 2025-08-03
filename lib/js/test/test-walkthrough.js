#!/usr/bin/env node
// test-walkthrough.js
// 本番のrag-common.jsのhandleOnLoadとhandleOnClickLoadDataを動作させてその結果を確認

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import pako from 'pako';
import { pipeline, env } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Transformers.js環境設定
env.allowRemoteModels = true;
env.allowLocalModels = true;
process.env.TRANSFORMERS_CACHE = path.join(process.cwd(), '.cache');

// test-setting.ymlを読み込み
const testSettingsPath = path.join(__dirname, 'test-setting.yml');
const testSettings = yaml.load(fs.readFileSync(testSettingsPath, 'utf8'));

// 動的なcurrent_siteを取得する関数
let currentSite = null;
async function getCurrentSite() {
    if (currentSite) return currentSite;
    
    const defaultSites = ['googology-wiki', 'ja-googology-wiki'];
    
    for (const site of defaultSites) {
        const configPath = path.join(__dirname, `../../../data/${site}/config.yml`);
        if (fs.existsSync(configPath)) {
            try {
                const yamlContent = fs.readFileSync(configPath, 'utf8');
                const config = yaml.load(yamlContent);
                if (config.web && config.web.current_site) {
                    currentSite = config.web.current_site;
                    console.log(`[config] current_site: ${currentSite}`);
                    return currentSite;
                }
            } catch (error) {
                console.warn(`[config] ${site}/config.yml読み込みエラー:`, error.message);
            }
        }
    }
    
    currentSite = 'googology-wiki';
    console.log(`[config] フォールバック current_site: ${currentSite}`);
    return currentSite;
}

// JSDOMでブラウザ環境を作成
const site = await getCurrentSite();
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <input id="base-url" value="${testSettings.elements?.baseUrl || 'https://api.openai.com/v1/chat/completions'}">
    <select id="model-select">
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-4o" ${testSettings.elements?.modelSelect === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
    </select>
    <input id="api-key" value="${testSettings.elements?.apiKey || ''}">
    <button id="load-data-btn">Load Data</button>
    <div id="loading-progress" style="display:none;"></div>
    <div id="loading-status"></div>
    <textarea id="prompt-window">${testSettings.elements?.promptWindow || ''}</textarea>
    <button id="send-btn" disabled>Send</button>
    <div id="response-window"></div>
    <div id="rag-window"></div>
    <div id="error-messages"></div>
    <a id="license-link" href="#"></a>
    <div id="fetch-date"></div>
    <div id="llm-prompt-debug-section"></div>
    <div id="debug-info-content"></div>
    <div id="system-prompt-content"></div>
    <div id="user-query-content"></div>
    <div id="api-config-form"></div>
    <div id="api-key-help"></div>
</body>
</html>
`, {
    url: `http://localhost:3000/data/${site}/`,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true
});

// グローバル変数の設定
const window = dom.window;
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.location = window.location;

// 相対パス対応のfetch実装
global.fetch = async function(url, options) {
    if (url.startsWith('./')) {
        const filePath = path.join(__dirname, `../../../data/${site}/`, url.substring(2));
        try {
            if (url.endsWith('.yml')) {
                const content = fs.readFileSync(filePath, 'utf8');
                return { ok: true, text: async () => content };
            } else if (url.endsWith('.json')) {
                const content = fs.readFileSync(filePath, 'utf8');
                return { ok: true, json: async () => JSON.parse(content) };
            } else if (url.endsWith('.gz')) {
                const content = fs.readFileSync(filePath);
                return { ok: true, arrayBuffer: async () => content.buffer };
            } else {
                const content = fs.readFileSync(filePath, 'utf8');
                return { ok: true, text: async () => content };
            }
        } catch (error) {
            return { ok: false, status: 404, statusText: 'Not Found' };
        }
    }
    
    const originalFetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
    return originalFetch(url, options);
};

// rag-common.jsからexport対応版を作成
async function createNodeJsVersion() {
    const ragCommonPath = path.join(__dirname, '../rag-common.js');
    const ragCommonCode = fs.readFileSync(ragCommonPath, 'utf8');
    
    // パスを調整（testディレクトリから見た相対パス）とvectorStoreをwindowに露出
    const finalCode = ragCommonCode
        .replace(/\.\/browser-header\.js/g, '../browser-header.js')
        .replace(/\.\/nodejs-header\.js/g, '../nodejs-header.js')
        // vectorStoreをwindowオブジェクトに露出（テスト用）
        .replace(/let vectorStore = null;/g, 'let vectorStore = null; if (typeof window !== "undefined") { window.vectorStore = null; }')
        // vectorStore設定完了後にwindow同期コードを追加
        .replace(
            /elements\.loadingStatus\.textContent = 'Data loaded successfully';/,
            'elements.loadingStatus.textContent = \'Data loaded successfully\';\n        // vectorStoreをwindowに同期（テスト用）\n        if (typeof window !== "undefined") {\n            window.vectorStore = vectorStore;\n        }'
        );
    
    // 一時ファイルを作成
    const tempPath = path.join(__dirname, 'temp-rag-common.mjs');
    fs.writeFileSync(tempPath, finalCode);
    
    return tempPath;
}

// rag-common.jsテスト実行
async function runWalkthroughTest() {
    console.log('=== rag-common.js動作確認テスト（handleOnLoad → handleOnClickLoadData） ===\n');
    
    try {
        // Node.js用バージョンを作成
        const tempPath = await createNodeJsVersion();
        
        try {
            // 動的import（既存のexportを使用）
            const { initializeRAG: handleOnLoad, handleOnClickLoadData } = await import(tempPath);
            
            // 必要なグローバル変数をwindowに設定
            window.fetch = global.fetch;
            window.pako = pako;
            window.yaml = yaml;
            window.yamlLoad = yaml.load;
            window.pipeline = pipeline;
            window.alert = (msg) => console.log(`[alert] ${msg}`);
            
            console.log('=== Step 1: handleOnLoad ===');
            console.log(`初期状態 - vectorStore: null, embedder: null, CONFIG: null\n`);
            
            console.log(`handleOnLoad実行: ${site}`);
            await handleOnLoad(site);
            
            console.log('\n=== Step 2: handleOnClickLoadData ===');
            
            // Load Dataボタンクリックのシミュレート
            const loadDataBtn = document.getElementById('load-data-btn');
            console.log('Load Dataボタンをクリック...');
            
            // フラグベースの完了検出
            let loadCompleted = false;
            let loadError = false;
            
            const statusElement = document.getElementById('loading-status');
            const sendBtn = document.getElementById('send-btn');
            
            const checkComplete = () => {
                const status = statusElement.textContent;
                const sendEnabled = !sendBtn.disabled;
                
                if (sendEnabled) {
                    loadCompleted = true;
                    console.log(`[完了検出] status="${status}", sendBtn.disabled=${sendBtn.disabled}`);
                    return true;
                }
                
                if (status.includes('Failed') || status.includes('Error')) {
                    loadError = true;
                    console.log(`[エラー検出] status="${status}"`);
                    return true;
                }
                
                return false;
            };
            
            // 初期チェック
            checkComplete();
            
            // Load Dataボタンクリック
            loadDataBtn.click();
            
            // 状態変化を定期的にチェック（最大3分）
            const maxChecks = 1800; // 3分間（100ms * 1800）
            let checks = 0;
            
            while (!loadCompleted && !loadError && checks < maxChecks) {
                await new Promise(resolve => setTimeout(resolve, 100));
                checks++;
                
                if (checkComplete()) {
                    break;
                }
                
                // 10秒ごとに進捗報告
                if (checks % 100 === 0) {
                    console.log(`[${checks/10}秒経過] status="${statusElement.textContent}"`);
                }
            }
            
            if (checks >= maxChecks) {
                console.log('⏰ タイムアウト: 3分経過しても完了しませんでした');
            }
            
            console.log(`handleOnClickLoadData完了`);
            
            // UI状態の最終確認
            console.log('\n=== 最終UI状態 ===');
            console.log(`loadDataBtn.disabled: ${document.getElementById('load-data-btn').disabled}`);
            console.log(`sendBtn.disabled: ${document.getElementById('send-btn').disabled}`);
            console.log(`loadingStatus: "${document.getElementById('loading-status').textContent}"`);
            
            // vector storeサイズ検証
            console.log('\n=== vector store サイズ検証 ===');
            const vectorStore = global.vectorStore || window.vectorStore;
            
            if (vectorStore) {
                const actualDocuments = vectorStore.totalDocuments || 0;
                const expectedDocuments = 105804; // メタデータからの期待値
                
                console.log(`期待ドキュメント数: ${expectedDocuments}`);
                console.log(`実際ドキュメント数: ${actualDocuments}`);
                
                if (actualDocuments === expectedDocuments) {
                    console.log('✅ ドキュメント数が正しく読み込まれています');
                } else {
                    console.log(`❌ ドキュメント数が不一致 (差: ${actualDocuments - expectedDocuments})`);
                }
                
                // パート数確認
                const actualParts = vectorStore.parts ? vectorStore.parts.length : 0;
                const expectedParts = 11;
                console.log(`期待パート数: ${expectedParts}`);
                console.log(`実際パート数: ${actualParts}`);
                
                if (actualParts === expectedParts) {
                    console.log('✅ パート数が正しく読み込まれています');
                } else {
                    console.log(`❌ パート数が不一致`);
                }
                
                // 埋め込み次元確認
                const actualDimension = vectorStore.embeddingDimension || 0;
                const expectedDimension = 768;
                console.log(`期待埋め込み次元: ${expectedDimension}`);
                console.log(`実際埋め込み次元: ${actualDimension}`);
                
                if (actualDimension === expectedDimension) {
                    console.log('✅ 埋め込み次元が正しく設定されています');
                } else {
                    console.log(`❌ 埋め込み次元が不一致`);
                }
            } else {
                console.log('❌ vectorStoreがnullのため検証できません');
            }
            
            if (!sendBtn.disabled) {
                console.log('\n✅ テスト完了 - vectorStoreが正常に設定されました');
            } else {
                console.log('\n❌ vectorStoreの読み込みが完了していません');
            }
            
        } finally {
            // 一時ファイル削除
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
        
    } catch (error) {
        console.error('\nテストエラー:', error);
        console.error(error.stack);
    }
    
    console.log('\n=== テスト完了 ===');
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
    runWalkthroughTest().then(() => {
        setTimeout(() => process.exit(0), 1000);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

export { runWalkthroughTest };