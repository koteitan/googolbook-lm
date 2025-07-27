#!/usr/bin/env node
/**
 * 多言語対応embeddingモデルでのJavaScriptテスト
 */

const fs = require('fs');
const path = require('path');

async function testModel(modelName, text) {
    console.log(`\n=== モデル: ${modelName} ===`);
    console.log(`テキスト: '${text}'`);
    
    try {
        // Transformers.js動的インポート
        const { pipeline, AutoTokenizer } = await import('@xenova/transformers');
        
        console.log(`\n--- Transformers.js Pipeline ---`);
        
        // Embedding pipeline初期化
        const embedder = await pipeline('feature-extraction', modelName);
        
        // Embedding生成
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        
        console.log(`✅ 成功 - Embedding shape: [${embedding.length}]`);
        console.log(`   Embedding (first 5): [${embedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
        
        console.log(`\n--- Tokenizer詳細 ---`);
        
        // Tokenizer詳細
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        const inputs = await tokenizer(text, { 
            return_tensor: false,
            padding: true,
            truncation: true
        });
        
        console.log(`Token IDs: [${inputs.input_ids.join(', ')}]`);
        
        // Token IDsをテキストに戻して確認
        const tokens = await tokenizer.batch_decode(inputs.input_ids.map(id => [id]), { skip_special_tokens: false });
        console.log(`Tokens: [${tokens.map(t => `'${t}'`).join(', ')}]`);
        
        // [UNK]の数をチェック
        const unkCount = tokens.filter(token => token === '[UNK]').length;
        console.log(`[UNK]トークン数: ${unkCount}`);
        
        return {
            model_name: modelName,
            success: true,
            embedding: embedding,
            token_ids: inputs.input_ids,
            tokens: tokens,
            unk_count: unkCount,
            embedding_dimension: embedding.length
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

async function main() {
    console.log("=== 多言語対応EmbeddingモデルJavaScriptテスト ===");
    
    try {
        // テストテキスト
        const testText = "グラハム数";
        
        // テスト対象モデル（Xenova版が利用可能なもの）
        const modelsToTest = [
            // 元のモデル（比較用）
            'Xenova/all-MiniLM-L6-v2',
            
            // 多言語対応モデル（Xenova版）
            'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            'Xenova/distiluse-base-multilingual-cased',
            'Xenova/paraphrase-multilingual-mpnet-base-v2',
            
            // その他の多言語モデル
            'Xenova/multilingual-e5-small',
            'Xenova/multilingual-e5-base',
        ];
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            try {
                const result = await testModel(modelName, testText);
                results.push(result);
                
                if (result.success) {
                    console.log(`✅ ${modelName}: 成功 ([UNK]: ${result.unk_count}個)`);
                } else {
                    console.log(`❌ ${modelName}: 失敗`);
                }
                
            } catch (error) {
                console.log(`❌ ${modelName}: スキップ - ${error.message}`);
                results.push({
                    model_name: modelName,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // 結果の比較
        console.log(`\n=== 結果比較 ===`);
        const successfulResults = results.filter(r => r.success);
        
        console.log(`成功したモデル数: ${successfulResults.length}/${modelsToTest.length}`);
        
        if (successfulResults.length >= 1) {
            console.log(`\n--- [UNK]トークン数比較 ---`);
            for (const result of successfulResults) {
                const status = result.unk_count === 0 ? "🟢 良好" : `🔴 ${result.unk_count}個`;
                console.log(`  ${result.model_name}: ${status}`);
            }
            
            // 最もUNKが少ないモデルを推奨
            const bestModels = successfulResults.filter(r => r.unk_count === 0);
            if (bestModels.length > 0) {
                console.log(`\n🎯 推奨モデル ([UNK]なし):`);
                for (const model of bestModels) {
                    console.log(`  - ${model.model_name}`);
                    console.log(`    次元: ${model.embedding_dimension}`);
                    console.log(`    トークン数: ${model.tokens.length}`);
                }
            } else {
                const minUnk = Math.min(...successfulResults.map(r => r.unk_count));
                const bestModels = successfulResults.filter(r => r.unk_count === minUnk);
                console.log(`\n🔶 相対的に良いモデル ([UNK]: ${minUnk}個):`);
                for (const model of bestModels) {
                    console.log(`  - ${model.model_name}`);
                    console.log(`    次元: ${model.embedding_dimension}`);
                }
            }
        }
        
        // 結果をJSONファイルに保存
        const outputFile = path.join(__dirname, 'multilingual_test_results_js.json');
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
        
        console.log(`\n詳細結果を保存しました: ${outputFile}`);
        
    } catch (error) {
        console.error('Error during multilingual model test:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}