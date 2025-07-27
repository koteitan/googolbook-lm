#!/usr/bin/env node
/**
 * Embeddingベクトルの詳細比較 - 入力層（Token IDs）と出力層（Embedding）
 */

const fs = require('fs');
const path = require('path');

function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (normA * normB);
}

function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, ai, i) => sum + (ai - b[i]) ** 2, 0));
}

function vectorNorm(vec) {
    return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

async function testEmbeddingVectors(modelName, testTexts) {
    console.log(`\n=== モデル: ${modelName} ===`);
    
    try {
        // Transformers.js動的インポート
        const { pipeline, AutoTokenizer } = await import('@xenova/transformers');
        
        // EmbedderとTokenizerを初期化
        const embedder = await pipeline('feature-extraction', modelName);
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        
        const results = [];
        
        for (let i = 0; i < testTexts.length; i++) {
            const text = testTexts[i];
            console.log(`\n--- テキスト ${i+1}: '${text}' ---`);
            
            // 1. Token IDs（入力層）
            const inputs = await tokenizer(text, { 
                return_tensor: false,
                padding: true,
                truncation: true
            });
            
            const tokenIds = inputs.input_ids;
            const attentionMask = inputs.attention_mask;
            const tokens = await tokenizer.batch_decode(
                tokenIds.map(id => [id]), 
                { skip_special_tokens: false }
            );
            
            console.log(`Token IDs: [${tokenIds.join(', ')}]`);
            console.log(`Tokens: [${tokens.map(t => `'${t}'`).join(', ')}]`);
            console.log(`Attention mask: [${attentionMask.join(', ')}]`);
            
            // 2. Embedding（出力層）
            const output = await embedder(text, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);
            const embeddingNorm = vectorNorm(embedding);
            
            console.log(`Embedding shape: [${embedding.length}]`);
            console.log(`Embedding L2 norm: ${embeddingNorm.toFixed(6)}`);
            console.log(`Embedding (first 5): [${embedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`Embedding (last 5): [${embedding.slice(-5).map(x => x.toFixed(6)).join(', ')}]`);
            
            results.push({
                text: text,
                token_ids: tokenIds,
                tokens: tokens,
                attention_mask: attentionMask,
                embedding: embedding,
                embedding_norm: embeddingNorm,
                embedding_dimension: embedding.length
            });
        }
        
        return {
            model_name: modelName,
            success: true,
            results: results
        };
        
    } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        return {
            model_name: modelName,
            success: false,
            error: error.message
        };
    }
}

function compareEmbeddingsBetweenTexts(results, modelName) {
    console.log(`\n=== ${modelName} - テキスト間比較 ===`);
    
    const embeddings = results.map(r => r.embedding);
    const texts = results.map(r => r.text);
    
    // ペアワイズ比較
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
            const cosineSim = cosineSimilarity(embeddings[i], embeddings[j]);
            const euclideanDist = euclideanDistance(embeddings[i], embeddings[j]);
            
            console.log(`'${texts[i]}' vs '${texts[j]}':`);
            console.log(`  コサイン類似度: ${cosineSim.toFixed(6)}`);
            console.log(`  ユークリッド距離: ${euclideanDist.toFixed(6)}`);
        }
    }
}

function compareTokenIdsBetweenModels(pyResults, jsResults) {
    console.log(`\n=== Token IDs比較（Python vs JavaScript） ===`);
    
    for (let i = 0; i < pyResults.length; i++) {
        const text = pyResults[i].text;
        const pyTokens = pyResults[i].token_ids;
        const jsTokens = jsResults[i].token_ids;
        
        console.log(`\nテキスト ${i+1}: '${text}'`);
        console.log(`Python Token IDs:     [${pyTokens.join(', ')}]`);
        console.log(`JavaScript Token IDs: [${jsTokens.join(', ')}]`);
        
        // Token IDsの一致性
        if (JSON.stringify(pyTokens) === JSON.stringify(jsTokens)) {
            console.log(`✅ Token IDs一致`);
        } else {
            console.log(`❌ Token IDs不一致`);
            console.log(`   長さ: Python=${pyTokens.length}, JavaScript=${jsTokens.length}`);
            
            // 差異の詳細
            const maxLen = Math.max(pyTokens.length, jsTokens.length);
            const differences = [];
            for (let pos = 0; pos < maxLen; pos++) {
                const pyId = pos < pyTokens.length ? pyTokens[pos] : null;
                const jsId = pos < jsTokens.length ? jsTokens[pos] : null;
                if (pyId !== jsId) {
                    differences.push([pos, pyId, jsId]);
                }
            }
            
            if (differences.length > 0) {
                console.log(`   差異位置: ${differences.length}箇所`);
                for (let k = 0; k < Math.min(differences.length, 5); k++) {
                    const [pos, pyId, jsId] = differences[k];
                    console.log(`     位置${pos}: Python=${pyId}, JavaScript=${jsId}`);
                }
            }
        }
    }
}

function compareEmbeddingsBetweenModels(pyResults, jsResults) {
    console.log(`\n=== Embedding比較（Python vs JavaScript） ===`);
    
    for (let i = 0; i < pyResults.length; i++) {
        const text = pyResults[i].text;
        const pyEmbedding = pyResults[i].embedding;
        const jsEmbedding = jsResults[i].embedding;
        
        console.log(`\nテキスト ${i+1}: '${text}'`);
        console.log(`Python Embedding L2 norm:     ${pyResults[i].embedding_norm.toFixed(6)}`);
        console.log(`JavaScript Embedding L2 norm: ${jsResults[i].embedding_norm.toFixed(6)}`);
        
        // 次元の一致性
        if (pyEmbedding.length === jsEmbedding.length) {
            console.log(`✅ 次元一致: [${pyEmbedding.length}]`);
            
            // コサイン類似度
            const cosineSim = cosineSimilarity(pyEmbedding, jsEmbedding);
            console.log(`コサイン類似度: ${cosineSim.toFixed(6)}`);
            
            // ユークリッド距離
            const euclideanDist = euclideanDistance(pyEmbedding, jsEmbedding);
            console.log(`ユークリッド距離: ${euclideanDist.toFixed(6)}`);
            
            // 要素レベルの比較（最初と最後の5要素）
            console.log(`Python (first 5):     [${pyEmbedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`JavaScript (first 5):  [${jsEmbedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`Python (last 5):      [${pyEmbedding.slice(-5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`JavaScript (last 5):   [${jsEmbedding.slice(-5).map(x => x.toFixed(6)).join(', ')}]`);
            
            // 統計的指標
            const absDiffs = pyEmbedding.map((val, idx) => Math.abs(val - jsEmbedding[idx]));
            const maxAbsDiff = Math.max(...absDiffs);
            const meanAbsDiff = absDiffs.reduce((sum, diff) => sum + diff, 0) / absDiffs.length;
            
            console.log(`最大絶対差: ${maxAbsDiff.toFixed(6)}`);
            console.log(`平均絶対差: ${meanAbsDiff.toFixed(6)}`);
            
        } else {
            console.log(`❌ 次元不一致: Python=[${pyEmbedding.length}], JavaScript=[${jsEmbedding.length}]`);
        }
    }
}

async function loadPythonResults() {
    try {
        const filePath = path.join(__dirname, 'embedding_vectors_python.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.log(`⚠️ Python結果ファイルが見つかりません: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log("=== Embeddingベクトル詳細比較テスト（JavaScript版） ===");
    
    try {
        // テストテキスト
        const testTexts = [
            "グラハム数",
            "巨大数は、気の遠くなるほど大きな有限の数である。",
            "Hello World",  // 英語（基準）
            "数学",  // 短い日本語
        ];
        
        console.log(`テストテキスト:`);
        testTexts.forEach((text, i) => {
            console.log(`  ${i+1}. '${text}'`);
        });
        
        // テスト対象モデル（最も一致しそうなもの）
        const modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
        
        // JavaScript版テスト
        console.log(`\n${'='.repeat(60)}`);
        console.log(`JavaScript版テスト`);
        console.log(`${'='.repeat(60)}`);
        const jsModelResult = await testEmbeddingVectors(modelName, testTexts);
        
        if (jsModelResult.success) {
            compareEmbeddingsBetweenTexts(jsModelResult.results, `JavaScript ${modelName}`);
        }
        
        // 結果をJSONファイルに保存
        const outputFile = path.join(__dirname, 'embedding_vectors_javascript.json');
        fs.writeFileSync(outputFile, JSON.stringify({
            test_texts: testTexts,
            model_result: jsModelResult
        }, null, 2), 'utf-8');
        
        console.log(`\nJavaScript結果を保存しました: ${outputFile}`);
        
        // Python結果との比較
        const pythonData = await loadPythonResults();
        if (pythonData && pythonData.model_result.success && jsModelResult.success) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Python vs JavaScript 比較`);
            console.log(`${'='.repeat(60)}`);
            
            compareTokenIdsBetweenModels(
                pythonData.model_result.results, 
                jsModelResult.results
            );
            
            compareEmbeddingsBetweenModels(
                pythonData.model_result.results, 
                jsModelResult.results
            );
        }
        
    } catch (error) {
        console.error('Error during embedding vectors test:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}