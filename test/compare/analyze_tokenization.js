#!/usr/bin/env node
/**
 * Token化の詳細分析 - 区切り位置と文字レベルマッピング（JavaScript版）
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
    console.log(`\n=== 文字レベルToken化分析 ===`);
    console.log(`元テキスト: '${text}'`);
    console.log(`文字数: ${text.length}`);
    
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
    console.log(`Token数: ${tokens.length}`);
    
    // 特殊トークンを除いたコンテンツトークンのみ抽出
    const contentTokens = [];
    const contentTokenIds = [];
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenId = tokenIds[i];
        
        // 特殊トークン（<s>, </s>, 空文字など）をスキップ
        if (token !== '<s>' && token !== '</s>' && token !== '<pad>' && token !== '<unk>' && token !== '<mask>') {
            contentTokens.push(token);
            contentTokenIds.push(tokenId);
        }
    }
    
    console.log(`\nコンテンツトークン: [${contentTokens.map(t => `'${t}'`).join(', ')}]`);
    console.log(`コンテンツToken IDs: [${contentTokenIds.join(', ')}]`);
    
    // 文字とトークンの対応関係を分析
    console.log(`\n=== 文字とTokenの対応関係 ===`);
    
    // デコードして文字位置を特定
    const decodedText = await tokenizer.decode(tokenIds, { skip_special_tokens: true });
    console.log(`デコード結果: '${decodedText}'`);
    
    // 個別トークンのデコード
    console.log(`\n=== 個別Token分析 ===`);
    let charPosition = 0;
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenId = tokenIds[i];
        
        if (token === '<s>' || token === '</s>') {
            console.log(`Token ${i.toString().padStart(2)}: '${token}' (ID: ${tokenId}) → 特殊トークン`);
            continue;
        }
        
        // 個別デコード
        const individualDecoded = await tokenizer.decode([tokenId], { skip_special_tokens: true });
        console.log(`Token ${i.toString().padStart(2)}: '${token}' (ID: ${tokenId}) → デコード: '${individualDecoded}'`);
        
        // 文字位置の推定
        if (individualDecoded && text.includes(individualDecoded)) {
            const position = text.indexOf(individualDecoded, charPosition);
            if (position !== -1) {
                const endPosition = position + individualDecoded.length;
                console.log(`         文字位置: ${position}-${endPosition} ('${text.substring(position, endPosition)}')`);
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
    console.log(`\n=== 形態素境界分析 ===`);
    
    // TinySegmenter参考結果
    const segmenter = new TinySegmenter();
    const tinySegmenterWords = segmenter.segment(text);
    console.log(`TinySegmenter形態素解析: [${tinySegmenterWords.map(w => `'${w}'`).join(', ')}]`);
    
    // Tokenizerの結果
    const inputs = await tokenizer(text, { return_tensor: false });
    const tokens = await tokenizer.batch_decode(
        inputs.input_ids.map(id => [id]), 
        { skip_special_tokens: false }
    );
    
    // 特殊トークンを除去
    const contentTokens = tokens.filter(t => t !== '<s>' && t !== '</s>' && t !== '<pad>' && t !== '<unk>' && t !== '<mask>');
    
    // 空文字やスペース文字の処理
    const processedTokens = [];
    for (const token of contentTokens) {
        if (token.trim() === '') {
            // 空文字やスペースのみのトークン
            if (token === '') {
                processedTokens.push('[EMPTY]');
            } else {
                processedTokens.push('[SPACE]');
            }
        } else {
            processedTokens.push(token);
        }
    }
    
    // 特殊記号を除去
    const finalTokens = processedTokens.filter(t => t !== '[EMPTY]');
    
    console.log(`Tokenizer結果: [${finalTokens.map(t => `'${t}'`).join(', ')}]`);
    
    // 境界の比較
    console.log(`\n=== 境界比較 ===`);
    console.log(`TinySegmenter境界数: ${tinySegmenterWords.length - 1}`);
    console.log(`Tokenizer境界数: ${finalTokens.length - 1}`);
    
    console.log(`\nTinySegmenter単語:`);
    tinySegmenterWords.forEach((word, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. '${word}'`);
    });
    
    console.log(`\nTokenizer単語:`);
    finalTokens.forEach((token, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. '${token}'`);
    });
    
    // 一致分析
    console.log(`\n=== 一致分析 ===`);
    const tinySegmenterText = tinySegmenterWords.join('');
    const tokenizerText = finalTokens.filter(t => t !== '[SPACE]').join('');
    
    console.log(`TinySegmenter再結合: '${tinySegmenterText}'`);
    console.log(`Tokenizer再結合: '${tokenizerText}'`);
    console.log(`元テキスト: '${text}'`);
    
    if (tinySegmenterText === text && tokenizerText === text) {
        console.log("✅ 両方とも元テキストと一致");
    } else if (tokenizerText === text) {
        console.log("✅ Tokenizerのみ元テキストと一致");
    } else if (tinySegmenterText === text) {
        console.log("✅ TinySegmenterのみ元テキストと一致");
    } else {
        console.log("❌ いずれも元テキストと不一致");
    }
    
    return {
        tinysegmenter_words: tinySegmenterWords,
        tokenizer_words: finalTokens,
        tinysegmenter_text: tinySegmenterText,
        tokenizer_text: tokenizerText
    };
}

async function main() {
    console.log("=== Token化詳細分析（JavaScript版） ===");
    
    try {
        // テストテキスト
        const testText = "巨大数は、気の遠くなるほど大きな有限の数である。";
        
        // 多言語モデルのTokenizer
        const modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
        
        console.log(`モデル: ${modelName}`);
        console.log(`テストテキスト: '${testText}'`);
        
        // Transformers.js動的インポート
        const { AutoTokenizer } = await import('@xenova/transformers');
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        
        // 文字レベル分析
        const charAnalysis = await analyzeCharacterToTokenMapping(testText, tokenizer);
        
        // 形態素境界分析
        const morphAnalysis = await analyzeMorphologicalBoundaries(testText, tokenizer);
        
        // 結果保存
        const outputFile = path.join(__dirname, 'tokenization_analysis_js.json');
        fs.writeFileSync(outputFile, JSON.stringify({
            character_analysis: charAnalysis,
            morphological_analysis: morphAnalysis
        }, null, 2), 'utf-8');
        
        console.log(`\n分析結果を保存しました: ${outputFile}`);
        
    } catch (error) {
        console.error('エラー:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}