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

// テストモード有効化
process.env.NODE_ENV = 'test';

// test-setting.ymlを読み込み
const testSettingsPath = path.join(__dirname, 'test-setting.yml');
const testSettings = yaml.load(fs.readFileSync(testSettingsPath, 'utf8'));

// 動的なcurrent_siteを取得する関数
let currentSite = null;
async function getCurrentSite() {
    if (currentSite) return currentSite;
    
    // 1. ルートのconfig.ymlを最優先で確認
    const rootConfigPath = path.join(__dirname, '../../../config.yml');
    if (fs.existsSync(rootConfigPath)) {
        try {
            const yamlContent = fs.readFileSync(rootConfigPath, 'utf8');
            const config = yaml.load(yamlContent);
            if (config.current_site) {
                currentSite = config.current_site;
                console.log(`[config] current_site: ${currentSite} (from root config.yml)`);
                return currentSite;
            }
        } catch (error) {
            console.warn(`[config] root config.yml読み込みエラー:`, error.message);
        }
    }
    
    // 2. 各サイトのconfig.ymlを確認（フォールバック）
    const defaultSites = ['googology-wiki', 'ja-googology-wiki'];
    
    for (const site of defaultSites) {
        const configPath = path.join(__dirname, `../../../data/${site}/config.yml`);
        if (fs.existsSync(configPath)) {
            try {
                const yamlContent = fs.readFileSync(configPath, 'utf8');
                const config = yaml.load(yamlContent);
                if (config.web && config.web.current_site) {
                    currentSite = config.web.current_site;
                    console.log(`[config] current_site: ${currentSite} (from ${site}/config.yml)`);
                    return currentSite;
                }
            } catch (error) {
                console.warn(`[config] ${site}/config.yml読み込みエラー:`, error.message);
            }
        }
    }
    
    // config.ymlが見つからない、またはcurrent_siteが設定されていない場合はエラー終了
    console.error(`[config] エラー: config.ymlが見つからない、またはcurrent_siteが設定されていません`);
    console.error(`[config] 確認対象: config.yml, ${defaultSites.map(site => `data/${site}/config.yml`).join(', ')}`);
    process.exit(1);
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
const originalFetch = typeof globalThis.fetch !== 'undefined' ? globalThis.fetch : (await import('node-fetch')).default;
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
    
    return originalFetch(url, options);
};

// rag-common.jsからexport対応版を作成
async function createNodeJsVersion() {
    const ragCommonPath = path.join(__dirname, '../rag-common.js');
    const ragCommonCode = fs.readFileSync(ragCommonPath, 'utf8');
    
    // パスを調整（testディレクトリから見た相対パス）
    const finalCode = ragCommonCode
        .replace(/\.\/browser-header\.js/g, '../browser-header.js')
        .replace(/\.\/nodejs-header\.js/g, '../nodejs-header.js');
    
    // 一時ファイルを作成
    const tempPath = path.join(__dirname, 'temp-rag-common.mjs');
    fs.writeFileSync(tempPath, finalCode);
    
    return tempPath;
}

// rag-common.jsテスト実行
async function runWalkthroughTest() {
    console.log('=== rag-common.js動作確認テスト（handleOnLoad → handleOnClickLoadData → handleOnSend） ===\n');
    
    try {
        // Node.js用バージョンを作成
        const tempPath = await createNodeJsVersion();
        
        try {
            // 動的import（既存のexportを使用）
            const { initializeRAG: handleOnLoad, handleOnClickLoadData, handleOnSend } = await import(tempPath);
            
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
                // 動的にメタデータから期待値を取得
                const metaPath = path.join(__dirname, `../../../data/${site}/vector_store_meta.json`);
                const metaContent = fs.readFileSync(metaPath, 'utf8');
                const expectedMetadata = JSON.parse(metaContent);
                
                const actualDocuments = vectorStore.totalDocuments || 0;
                const expectedDocuments = expectedMetadata.total_documents;
                
                console.log(`期待ドキュメント数: ${expectedDocuments}`);
                console.log(`実際ドキュメント数: ${actualDocuments}`);
                
                if (actualDocuments === expectedDocuments) {
                    console.log('✅ ドキュメント数が正しく読み込まれています');
                } else {
                    console.log(`❌ ドキュメント数が不一致 (差: ${actualDocuments - expectedDocuments})`);
                }
                
                // パート数確認
                const actualParts = vectorStore.parts ? vectorStore.parts.length : 0;
                const expectedParts = expectedMetadata.num_parts;
                console.log(`期待パート数: ${expectedParts}`);
                console.log(`実際パート数: ${actualParts}`);
                
                if (actualParts === expectedParts) {
                    console.log('✅ パート数が正しく読み込まれています');
                } else {
                    console.log(`❌ パート数が不一致`);
                }
                
                // 埋め込み次元確認
                const actualDimension = vectorStore.embeddingDimension || 0;
                const expectedDimension = expectedMetadata.embedding_dimension;
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
                console.log('\n✅ Step 2完了 - vectorStoreが正常に設定されました');
                
                // Step 3: handleOnSendテスト
                console.log('\n=== Step 3: handleOnSend ===');
                
                // プロンプト窓にテスト質問を設定
                const promptWindow = document.getElementById('prompt-window');
                const testQuery = testSettings.elements.promptWindow;
                promptWindow.value = testQuery;
                console.log(`テスト質問: "${testQuery}"`);
                
                // API設定をtest-setting.ymlから設定
                const baseUrlInput = document.getElementById('base-url');
                const apiKeyInput = document.getElementById('api-key');
                const modelSelect = document.getElementById('model-select');
                
                baseUrlInput.value = testSettings.elements.baseUrl;
                apiKeyInput.value = testSettings.elements.apiKey;
                modelSelect.value = testSettings.elements.modelSelect;
                
                console.log('本番環境API設定完了');
                
                // 応答とRAG結果をクリア
                const responseWindow = document.getElementById('response-window');
                const ragWindow = document.getElementById('rag-window');
                responseWindow.innerHTML = '';
                ragWindow.innerHTML = '';
                
                // handleOnSend実行
                console.log('Sendボタンをクリック...');
                
                // 送信完了検出フラグ
                let sendCompleted = false;
                let sendError = false;
                
                const checkSendComplete = () => {
                    const responseContent = responseWindow.textContent || responseWindow.innerHTML;
                    const ragContent = ragWindow.textContent || ragWindow.innerHTML;
                    const errorContent = document.getElementById('error-messages').textContent;
                    
                    // エラーチェック
                    if (errorContent.includes('Error') || errorContent.includes('Failed') ||
                        responseContent.includes('Error') || responseContent.includes('Failed')) {
                        sendError = true;
                        console.log(`[送信処理完了] エラーレスポンス検出`);
                        return true;
                    }
                    
                    // 正常なLLM応答チェック
                    if (responseContent.length > 10) {
                        sendCompleted = true;
                        console.log(`[送信処理完了] LLM応答が生成されました`);
                        return true;
                    }
                    
                    // RAG結果が表示されたかチェック
                    if (ragContent.length > 10) {
                        sendCompleted = true;
                        console.log(`[送信処理完了] RAG結果が表示されました`);
                        return true;
                    }
                    
                    return false;
                };
                
                // Sendボタンクリック
                sendBtn.click();
                
                // 送信処理の完了を待機（最大30秒）
                const maxSendChecks = 300; // 30秒（100ms * 300）
                let sendChecks = 0;
                
                while (!sendCompleted && !sendError && sendChecks < maxSendChecks) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    sendChecks++;
                    
                    if (checkSendComplete()) {
                        break;
                    }
                    
                    // 5秒ごとに進捗報告
                    if (sendChecks % 50 === 0) {
                        console.log(`[${sendChecks/10}秒経過] 送信処理待機中...`);
                    }
                }
                
                if (sendChecks >= maxSendChecks) {
                    console.log('⏰ 送信処理タイムアウト: 30秒経過しても完了しませんでした');
                }
                
                // handleOnSend結果確認
                console.log('\n=== handleOnSend結果確認 ===');
                const finalResponseContent = responseWindow.textContent || responseWindow.innerHTML;
                const finalRagContent = ragWindow.textContent || ragWindow.innerHTML;
                const finalErrorContent = document.getElementById('error-messages').textContent;
                
                console.log(`Response窓内容長: ${finalResponseContent.length}文字`);
                console.log(`RAG窓内容長: ${finalRagContent.length}文字`);
                console.log(`Error内容: "${finalErrorContent}"`);
                
                if (finalRagContent.length > 10) {
                    console.log('✅ RAG検索が実行され結果が表示されました');
                } else {
                    console.log('❌ RAG検索結果が表示されていません');
                }
                
                if (finalResponseContent.length > 10) {
                    console.log('✅ LLM応答が正常に生成されました');
                } else if (sendError) {
                    console.log('⚠️ エラーが発生しましたが送信処理は実行されました');
                } else {
                    console.log('❌ 送信処理が完了していません');
                }
                
                console.log('\n✅ 全テスト完了 - handleOnLoad → handleOnClickLoadData → handleOnSend');
            } else {
                console.log('\n❌ vectorStoreの読み込みが完了していないため、handleOnSendテストをスキップします');
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