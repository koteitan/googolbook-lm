#!/usr/bin/env node
/**
 * Tokenizer test tool for JavaScript embedding models and kuromoji.js.
 * 
 * This tool uses the same tokenization logic as lib/rag-common.js to test
 * morphological analysis and compare tokenization results.
 * 
 * Usage:
 *   echo "グラハム数" | node test-token.js
 *   node test-token.js < input.txt
 *   node test-token.js  # Then type text and press Ctrl+D
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { load as yamlLoad } from 'js-yaml';

// Import shared morphological analyzer
import { globalMorphAnalyzer as japaneseMorphAnalyzer } from '../../lib/morphological-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration from YAML
async function loadConfig(siteName) {
    try {
        const configPath = join(__dirname, '../../data', siteName, 'config.yml');
        const yamlText = readFileSync(configPath, 'utf8');
        const config = yamlLoad(yamlText);
        return config;
    } catch (error) {
        console.error(`Failed to load config for site ${siteName}:`, error.message);
        return null;
    }
}

// Test kuromoji.js morphological analyzer
async function testKuromojiTokenizer(text) {
    console.log(`\n=== Kuromoji.js Morphological Analyzer ===`);
    
    try {
        await japaneseMorphAnalyzer.initialize();
        const tokenized = japaneseMorphAnalyzer.tokenize(text);
        
        console.log(`Original text: "${text}"`);
        console.log(`Tokenized text: "${tokenized}"`);
        
        // Show detailed morphemes using the common library method
        const detailedTokens = japaneseMorphAnalyzer.getDetailedTokens(text);
        if (detailedTokens && detailedTokens.length > 0) {
            console.log(`Number of morphemes: ${detailedTokens.length}`);
            console.log("\nDetailed morphemes:");
            console.log("-".repeat(50));
            
            detailedTokens.forEach((token, i) => {
                console.log(`${(i+1).toString().padStart(3)} | ${token.surface_form.padEnd(10)} | ${token.pos} | ${token.reading || 'N/A'}`);
            });
        }
        
        return tokenized;
    } catch (error) {
        console.error('❌ Kuromoji tokenizer failed:', error);
        return text;
    }
}

async function main() {
    // Get site name from command line argument or default
    const siteName = process.argv[2] || 'ja-googology-wiki';
    
    // Load site configuration
    const config = await loadConfig(siteName);
    const tokenizeMode = config?.tokenize?.mode || 'normal';
    
    console.error(`Current site: ${siteName}`);
    console.error(`Tokenize mode: ${tokenizeMode}`);
    console.error('');
    
    // Read input from stdin
    console.error('Enter text to tokenize (Ctrl+D to finish):');
    let input = '';
    
    if (process.stdin.isTTY) {
        // Interactive mode
        process.stdin.setEncoding('utf8');
        for await (const chunk of process.stdin) {
            input += chunk;
        }
    } else {
        // Pipe mode
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString('utf8');
    }
    
    const text = input.trim();
    
    if (!text) {
        console.error('No input provided.');
        process.exit(1);
    }
    
    console.log(`\nInput text: "${text}"`);
    console.log('='.repeat(60));
    
    // Test TinySegmenter tokenizer if configured
    if (tokenizeMode === 'mecab' || tokenizeMode === 'tinysegmenter') {
        await testKuromojiTokenizer(text);
        
        console.log('\n=== Summary ===');
        console.log(`Current configuration uses ${tokenizeMode} for Japanese morphological analysis.`);
        console.log('This matches the browser-side tokenization in rag-common.js.');
    } else {
        console.log('\n=== Configuration ===');
        console.log('Current configuration uses standard tokenization.');
        console.log('To test TinySegmenter, change tokenize.mode to "tinysegmenter" in config.yml');
        console.log('\nNote: This tool focuses on morphological analysis testing.');
        console.log('For embedding tests, use the browser-side interface.');
    }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error.message);
    process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Main function failed:', error);
        process.exit(1);
    });
}