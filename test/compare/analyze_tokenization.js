#!/usr/bin/env node
/**
 * Detailed tokenization analysis - Segmentation boundaries and character-level mapping (JavaScript version)
 */

const fs = require('fs');
const path = require('path');

// TinySegmenter implementation
class TinySegmenter {
    constructor() {
        this.patterns = {
            "[一-龠々〆ヵヶ]": "M",
            "[ぁ-ん]": "H", 
            "[ァ-ヴー]": "K",
            "[a-zA-Z]": "A",
            "[0-9]": "N"
        };
    }

    ctype(str) {
        for (const pat in this.patterns) {
            if (str.match(new RegExp(pat))) {
                return this.patterns[pat];
            }
        }
        return "O";
    }

    segment(input) {
        if (!input) return [];
        
        // Simplified segmentation
        const result = [];
        let current = "";
        let prevType = null;
        
        for (let i = 0; i < input.length; i++) {
            const char = input.charAt(i);
            const type = this.ctype(char);
            
            if (prevType && prevType !== type && current.length > 0) {
                result.push(current);
                current = char;
            } else {
                current += char;
            }
            prevType = type;
        }
        
        if (current.length > 0) {
            result.push(current);
        }
        
        return result;
    }
}

async function analyzeCharacterToTokenMapping(text, tokenizer) {
    console.log(`\n=== Character-level tokenization analysis ===`);
    console.log(`Original text: '${text}'`);
    console.log(`Character count: ${text.length}`);
    
    // Tokenization
    const inputs = await tokenizer(text, { 
        return_tensor: false,
        padding: true,
        truncation: true
    });
    
    const tokenIds = inputs.input_ids;
    const tokens = await tokenizer.batch_decode(
        tokenIds.map(id => [id]), 
        { skip_special_tokens: false }
    );
    
    console.log(`\nToken IDs: [${tokenIds.join(', ')}]`);
    console.log(`Tokens: [${tokens.map(t => `'${t}'`).join(', ')}]`);
    console.log(`Token count: ${tokens.length}`);
    
    // Extract content tokens only, excluding special tokens
    const contentTokens = [];
    const contentTokenIds = [];
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenId = tokenIds[i];
        
        // Skip special tokens (<s>, </s>, empty strings, etc.)
        if (token !== '<s>' && token !== '</s>' && token !== '<pad>' && token !== '<unk>' && token !== '<mask>') {
            contentTokens.push(token);
            contentTokenIds.push(tokenId);
        }
    }
    
    console.log(`\nContent tokens: [${contentTokens.map(t => `'${t}'`).join(', ')}]`);
    console.log(`Content Token IDs: [${contentTokenIds.join(', ')}]`);
    
    // Analyze correspondence between characters and tokens
    console.log(`\n=== Character-Token correspondence ===`);
    
    // Decode to identify character positions
    const decodedText = await tokenizer.decode(tokenIds, { skip_special_tokens: true });
    console.log(`Decoded result: '${decodedText}'`);
    
    // Decode individual tokens
    console.log(`\n=== Individual token analysis ===`);
    let charPosition = 0;
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenId = tokenIds[i];
        
        if (token === '<s>' || token === '</s>') {
            console.log(`Token ${i.toString().padStart(2)}: '${token}' (ID: ${tokenId}) → Special token`);
            continue;
        }
        
        // Individual decode
        const individualDecoded = await tokenizer.decode([tokenId], { skip_special_tokens: true });
        console.log(`Token ${i.toString().padStart(2)}: '${token}' (ID: ${tokenId}) → Decoded: '${individualDecoded}'`);
        
        // Estimate character position
        if (individualDecoded && text.includes(individualDecoded)) {
            const position = text.indexOf(individualDecoded, charPosition);
            if (position !== -1) {
                const endPosition = position + individualDecoded.length;
                console.log(`         Character position: ${position}-${endPosition} ('${text.substring(position, endPosition)}')`);
                charPosition = endPosition;
            }
        }
    }
    
    return {
        original_text: text,
        token_ids: tokenIds,
        tokens: tokens,
        content_tokens: contentTokens,
        decoded_text: decodedText
    };
}

async function analyzeMorphologicalBoundaries(text, tokenizer) {
    console.log(`\n=== Morphological boundary analysis ===`);
    
    // TinySegmenter reference result
    const segmenter = new TinySegmenter();
    const tinySegmenterWords = segmenter.segment(text);
    console.log(`TinySegmenter morphological analysis: [${tinySegmenterWords.map(w => `'${w}'`).join(', ')}]`);
    
    // Tokenizer result
    const inputs = await tokenizer(text, { return_tensor: false });
    const tokens = await tokenizer.batch_decode(
        inputs.input_ids.map(id => [id]), 
        { skip_special_tokens: false }
    );
    
    // Remove special tokens
    const contentTokens = tokens.filter(t => t !== '<s>' && t !== '</s>' && t !== '<pad>' && t !== '<unk>' && t !== '<mask>');
    
    // Handle empty strings and whitespace characters
    const processedTokens = [];
    for (const token of contentTokens) {
        if (token.trim() === '') {
            // Tokens that are empty strings or whitespace only
            if (token === '') {
                processedTokens.push('[EMPTY]');
            } else {
                processedTokens.push('[SPACE]');
            }
        } else {
            processedTokens.push(token);
        }
    }
    
    // Remove special symbols
    const finalTokens = processedTokens.filter(t => t !== '[EMPTY]');
    
    console.log(`Tokenizer result: [${finalTokens.map(t => `'${t}'`).join(', ')}]`);
    
    // Compare boundaries
    console.log(`\n=== Boundary comparison ===`);
    console.log(`TinySegmenter boundary count: ${tinySegmenterWords.length - 1}`);
    console.log(`Tokenizer boundary count: ${finalTokens.length - 1}`);
    
    console.log(`\nTinySegmenter words:`);
    tinySegmenterWords.forEach((word, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. '${word}'`);
    });
    
    console.log(`\nTokenizer words:`);
    finalTokens.forEach((token, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. '${token}'`);
    });
    
    // Match analysis
    console.log(`\n=== Match analysis ===`);
    const tinySegmenterText = tinySegmenterWords.join('');
    const tokenizerText = finalTokens.filter(t => t !== '[SPACE]').join('');
    
    console.log(`TinySegmenter recombined: '${tinySegmenterText}'`);
    console.log(`Tokenizer recombined: '${tokenizerText}'`);
    console.log(`Original text: '${text}'`);
    
    if (tinySegmenterText === text && tokenizerText === text) {
        console.log("✅ Both match original text");
    } else if (tokenizerText === text) {
        console.log("✅ Tokenizer only matches original text");
    } else if (tinySegmenterText === text) {
        console.log("✅ TinySegmenter only matches original text");
    } else {
        console.log("❌ Neither matches original text");
    }
    
    return {
        tinysegmenter_words: tinySegmenterWords,
        tokenizer_words: finalTokens,
        tinysegmenter_text: tinySegmenterText,
        tokenizer_text: tokenizerText
    };
}

async function main() {
    console.log("=== Detailed tokenization analysis (JavaScript version) ===");
    
    try {
        // Test text
        const testText = "巨大数は、気の遠くなるほど大きな有限の数である。";
        
        // Multilingual model Tokenizer
        const modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
        
        console.log(`Model: ${modelName}`);
        console.log(`Test text: '${testText}'`);
        
        // Dynamic import of Transformers.js
        const { AutoTokenizer } = await import('@xenova/transformers');
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        
        // Character-level analysis
        const charAnalysis = await analyzeCharacterToTokenMapping(testText, tokenizer);
        
        // Morphological boundary analysis
        const morphAnalysis = await analyzeMorphologicalBoundaries(testText, tokenizer);
        
        // Save results
        const outputFile = path.join(__dirname, 'tokenization_analysis_js.json');
        fs.writeFileSync(outputFile, JSON.stringify({
            character_analysis: charAnalysis,
            morphological_analysis: morphAnalysis
        }, null, 2), 'utf-8');
        
        console.log(`\nAnalysis results saved: ${outputFile}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}