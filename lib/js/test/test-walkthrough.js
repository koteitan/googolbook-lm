#!/usr/bin/env node
// test-walkthrough.js
// Test production rag-common.js handleOnLoad and handleOnClickLoadData functions and verify their results

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import pako from 'pako';
import { pipeline, env } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Transformers.js environment configuration
env.allowRemoteModels = true;
env.allowLocalModels = true;
process.env.TRANSFORMERS_CACHE = path.join(process.cwd(), '.cache');

// Enable test mode
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

// Load test-setting.yml
const testSettingsPath = path.join(__dirname, 'test-setting.yml');
const testSettings = yaml.load(fs.readFileSync(testSettingsPath, 'utf8'));

// Function to dynamically get current_site
let currentSite = null;
async function getCurrentSite() {
    if (currentSite) return currentSite;
    
    // 1. Check root config.yml with highest priority
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
            console.warn(`[config] root config.yml load error:`, error.message);
        }
    }
    
    // 2. Check each site's config.yml (fallback)
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
                console.warn(`[config] ${site}/config.yml load error:`, error.message);
            }
        }
    }
    
    // Exit with error if config.yml not found or current_site not configured
    console.error(`[config] Error: config.yml not found or current_site not configured`);
    console.error(`[config] Check targets: config.yml, ${defaultSites.map(site => `data/${site}/config.yml`).join(', ')}`);
    process.exit(1);
}

// Create browser environment with JSDOM
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

// Set global variables
const window = dom.window;
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.location = window.location;

// Fetch implementation with relative path support
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

// Create export-compatible version from rag-common.js
async function createNodeJsVersion() {
    const ragCommonPath = path.join(__dirname, '../rag-common.js');
    const ragCommonCode = fs.readFileSync(ragCommonPath, 'utf8');
    
    // Adjust paths (relative paths from test directory)
    const finalCode = ragCommonCode
        .replace(/\.\/browser-header\.js/g, '../browser-header.js')
        .replace(/\.\/nodejs-header\.js/g, '../nodejs-header.js');
    
    // Create temporary file
    const tempPath = path.join(__dirname, 'temp-rag-common.mjs');
    fs.writeFileSync(tempPath, finalCode);
    
    return tempPath;
}

// Execute rag-common.js test
async function runWalkthroughTest() {
    console.log('=== rag-common.js functionality test (handleOnLoad → handleOnClickLoadData → handleOnSend) ===\n');
    
    try {
        // Create Node.js version
        const tempPath = await createNodeJsVersion();
        
        try {
            // Dynamic import (use existing exports)
            const { initializeRAG: handleOnLoad, handleOnClickLoadData, handleOnSend } = await import(tempPath);
            
            // Check TEST_MODE
            console.log(`TEST_MODE enabled: ${process.env.TEST_MODE}, NODE_ENV: ${process.env.NODE_ENV}`);
            
            // Set necessary global variables to window
            window.fetch = global.fetch;
            window.pako = pako;
            window.yaml = yaml;
            window.yamlLoad = yaml.load;
            window.pipeline = pipeline;
            window.alert = (msg) => console.log(`[alert] ${msg}`);
            
            console.log('=== Step 1: handleOnLoad ===');
            console.log(`Initial state - vectorStore: null, embedder: null, CONFIG: null\n`);
            
            console.log(`Execute handleOnLoad: ${site}`);
            await handleOnLoad(site);
            
            console.log('\n=== Step 2: handleOnClickLoadData ===');
            
            // Simulate Load Data button click
            const loadDataBtn = document.getElementById('load-data-btn');
            console.log('Clicking Load Data button...');
            
            // Flag-based completion detection
            let loadCompleted = false;
            let loadError = false;
            
            const statusElement = document.getElementById('loading-status');
            const sendBtn = document.getElementById('send-btn');
            
            const checkComplete = () => {
                const status = statusElement.textContent;
                const sendEnabled = !sendBtn.disabled;
                
                if (sendEnabled) {
                    loadCompleted = true;
                    console.log(`[Completion detected] status="${status}", sendBtn.disabled=${sendBtn.disabled}`);
                    return true;
                }
                
                if (status.includes('Failed') || status.includes('Error')) {
                    loadError = true;
                    console.log(`[Error detected] status="${status}"`);
                    return true;
                }
                
                return false;
            };
            
            // Initial check
            checkComplete();
            
            // Click Load Data button
            loadDataBtn.click();
            
            // Check status changes periodically (max 3 minutes)
            const maxChecks = 1800; // 3 minutes (100ms * 1800)
            let checks = 0;
            
            while (!loadCompleted && !loadError && checks < maxChecks) {
                await new Promise(resolve => setTimeout(resolve, 100));
                checks++;
                
                if (checkComplete()) {
                    break;
                }
                
                // Progress report every 10 seconds
                if (checks % 100 === 0) {
                    console.log(`[${checks/10} seconds elapsed] status="${statusElement.textContent}"`);
                }
            }
            
            if (checks >= maxChecks) {
                console.log('⏰ Timeout: Did not complete after 3 minutes');
            }
            
            console.log(`handleOnClickLoadData completed`);
            
            // Final UI status confirmation
            console.log('\n=== Final UI State ===');
            console.log(`loadDataBtn.disabled: ${document.getElementById('load-data-btn').disabled}`);
            console.log(`sendBtn.disabled: ${document.getElementById('send-btn').disabled}`);
            console.log(`loadingStatus: "${document.getElementById('loading-status').textContent}"`);
            
            // Vector store size verification
            console.log('\n=== Vector Store Size Verification ===');
            const vectorStore = global.vectorStore || window.vectorStore;
            
            if (vectorStore) {
                // Dynamically get expected values from metadata
                const metaPath = path.join(__dirname, `../../../data/${site}/vector_store_meta.json`);
                const metaContent = fs.readFileSync(metaPath, 'utf8');
                const expectedMetadata = JSON.parse(metaContent);
                
                const actualDocuments = vectorStore.totalDocuments || 0;
                const expectedDocuments = expectedMetadata.total_documents;
                
                console.log(`Expected documents: ${expectedDocuments}`);
                console.log(`Actual documents: ${actualDocuments}`);
                
                if (actualDocuments === expectedDocuments) {
                    console.log('✅ Document count loaded correctly');
                } else {
                    console.log(`❌ Document count mismatch (diff: ${actualDocuments - expectedDocuments})`);
                }
                
                // Check part count
                const actualParts = vectorStore.parts ? vectorStore.parts.length : 0;
                const expectedParts = expectedMetadata.num_parts;
                console.log(`Expected parts: ${expectedParts}`);
                console.log(`Actual parts: ${actualParts}`);
                
                if (actualParts === expectedParts) {
                    console.log('✅ Part count loaded correctly');
                } else {
                    console.log(`❌ Part count mismatch`);
                }
                
                // Check embedding dimension
                const actualDimension = vectorStore.embeddingDimension || 0;
                const expectedDimension = expectedMetadata.embedding_dimension;
                console.log(`Expected embedding dimension: ${expectedDimension}`);
                console.log(`Actual embedding dimension: ${actualDimension}`);
                
                if (actualDimension === expectedDimension) {
                    console.log('✅ Embedding dimension set correctly');
                } else {
                    console.log(`❌ Embedding dimension mismatch`);
                }
            } else {
                console.log('❌ Cannot verify because vectorStore is null');
            }
            
            if (!sendBtn.disabled) {
                console.log('\n✅ Step 2 completed - vectorStore successfully set up');
                
                // Step 3: handleOnSend test
                console.log('\n=== Step 3: handleOnSend Test ===');
                
                // Set test question in prompt window
                const promptWindow = document.getElementById('prompt-window');
                const testQuery = testSettings.elements.promptWindow;
                promptWindow.value = testQuery;
                console.log(`Test question: "${testQuery}"`);
                
                // Set API configuration from test-setting.yml
                const baseUrlInput = document.getElementById('base-url');
                const apiKeyInput = document.getElementById('api-key');
                const modelSelect = document.getElementById('model-select');
                
                baseUrlInput.value = testSettings.elements.baseUrl;
                apiKeyInput.value = testSettings.elements.apiKey;
                modelSelect.value = testSettings.elements.modelSelect;
                
                console.log('Production API configuration completed');
                
                // Clear response and RAG results
                const responseWindow = document.getElementById('response-window');
                const ragWindow = document.getElementById('rag-window');
                responseWindow.innerHTML = '';
                ragWindow.innerHTML = '';
                
                // Execute handleOnSend
                console.log('Clicking Send button...');
                
                // Send completion detection flags
                let sendCompleted = false;
                let sendError = false;
                
                const checkSendComplete = () => {
                    const responseContent = responseWindow.textContent || responseWindow.innerHTML;
                    const ragContent = ragWindow.textContent || ragWindow.innerHTML;
                    const errorContent = document.getElementById('error-messages').textContent;
                    
                    // Error check
                    if (errorContent.includes('Error') || errorContent.includes('Failed') ||
                        responseContent.includes('Error') || responseContent.includes('Failed')) {
                        sendError = true;
                        console.log(`[Send process completed] Error response detected`);
                        return true;
                    }
                    
                    // Check if still loading (still processing)
                    if (responseContent.includes('Searching and generating response') ||
                        responseContent.includes('loading-spinner') ||
                        ragContent.includes('loading-spinner')) {
                        return false; // still processing
                    }
                    
                    // Check for normal LLM response (content other than loading messages)
                    if (responseContent.length > 10 && !responseContent.includes('Searching and generating response')) {
                        sendCompleted = true;
                        console.log(`[Send process completed] LLM response generated`);
                        return true;
                    }
                    
                    // Check if RAG results are displayed (other than loading messages)
                    if (ragContent.length > 10 && !ragContent.includes('Searching documents')) {
                        sendCompleted = true;
                        console.log(`[Send process completed] RAG results displayed`);
                        return true;
                    }
                    
                    return false;
                };
                
                // Click Send button
                sendBtn.click();
                
                // Wait for send process completion (max 30 seconds)
                const maxSendChecks = 300; // 30 seconds (100ms * 300)
                let sendChecks = 0;
                
                while (!sendCompleted && !sendError && sendChecks < maxSendChecks) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    sendChecks++;
                    
                    if (checkSendComplete()) {
                        break;
                    }
                    
                    // Progress report every 5 seconds
                    if (sendChecks % 50 === 0) {
                        console.log(`[${sendChecks/10} seconds elapsed] Waiting for send process...`);
                    }
                }
                
                if (sendChecks >= maxSendChecks) {
                    console.log('⏰ Send process timeout: Did not complete after 30 seconds');
                }
                
                // handleOnSend result confirmation
                console.log('\n=== handleOnSend Result Confirmation ===');
                const finalResponseContent = responseWindow.textContent || responseWindow.innerHTML;
                const finalRagContent = ragWindow.textContent || ragWindow.innerHTML;
                const finalErrorContent = document.getElementById('error-messages').textContent;
                
                console.log(`Response window content length: ${finalResponseContent.length} characters`);
                console.log(`RAG window content length: ${finalRagContent.length} characters`);
                console.log(`Error content: "${finalErrorContent}"`);
                
                // Display detailed Response window content
                console.log('\n=== Response Window Detailed Content ===');
                if (finalResponseContent.length > 0) {
                    console.log('Response content:');
                    console.log('--- Response Begin ---');
                    console.log(finalResponseContent.substring(0, 2000)); // first 2000 characters
                    if (finalResponseContent.length > 2000) {
                        console.log(`... (${finalResponseContent.length - 2000} characters omitted)`);
                    }
                    console.log('--- Response End ---');
                } else {
                    console.log('Response content: (empty)');
                }
                
                // Display detailed RAG window content
                console.log('\n=== RAG Window Detailed Content ===');
                if (finalRagContent.length > 0) {
                    console.log('RAG Search Results content:');
                    console.log('--- RAG Results Begin ---');
                    console.log(finalRagContent.substring(0, 2000)); // first 2000 characters
                    if (finalRagContent.length > 2000) {
                        console.log(`... (remaining ${finalRagContent.length - 2000} characters omitted)`);
                    }
                    console.log('--- RAG Results End ---');
                } else {
                    console.log('RAG Search Results content: (empty)');
                }
                
                if (finalRagContent.length > 10) {
                    console.log('✅ RAG search executed and results displayed');
                } else {
                    console.log('❌ RAG search results not displayed');
                }
                
                if (finalResponseContent.length > 10) {
                    console.log('✅ LLM response generated successfully');
                } else if (sendError) {
                    console.log('⚠️ Error occurred but send process was executed');
                } else {
                    console.log('❌ Send process not completed');
                }
                
                console.log('\n✅ All tests completed - handleOnLoad → handleOnClickLoadData → handleOnSend');
            } else {
                console.log('\n❌ Skipping handleOnSend test because vectorStore loading is not completed');
            }
            
        } finally {
            // Delete temporary file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
        
    } catch (error) {
        console.error('\nTest error:', error);
        console.error(error.stack);
    }
    
    console.log('\n=== Test Completed ===');
}

// Execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runWalkthroughTest().then(() => {
        setTimeout(() => process.exit(0), 100);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

export { runWalkthroughTest };
