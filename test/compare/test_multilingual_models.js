#!/usr/bin/env node
/**
 * JavaScript test with multilingual embedding models
 */

const fs = require('fs');
const path = require('path');

async function testModel(modelName, text) {
    console.log(`\n=== Model: ${modelName} ===`);
    console.log(`Text: '${text}'`);
    
    try {
        // Dynamic import of Transformers.js
        const { pipeline, AutoTokenizer } = await import('@xenova/transformers');
        
        console.log(`\n--- Transformers.js Pipeline ---`);
        
        // Initialize Embedding pipeline
        const embedder = await pipeline('feature-extraction', modelName);
        
        // Generate Embedding
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        
        console.log(`✅ Success - Embedding shape: [${embedding.length}]`);
        console.log(`   Embedding (first 5): [${embedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
        
        console.log(`\n--- Tokenizer details ---`);
        
        // Tokenizer details
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        const inputs = await tokenizer(text, { 
            return_tensor: false,
            padding: true,
            truncation: true
        });
        
        console.log(`Token IDs: [${inputs.input_ids.join(', ')}]`);
        
        // Convert Token IDs back to text for verification
        const tokens = await tokenizer.batch_decode(inputs.input_ids.map(id => [id]), { skip_special_tokens: false });
        console.log(`Tokens: [${tokens.map(t => `'${t}'`).join(', ')}]`);
        
        // Check number of [UNK] tokens
        const unkCount = tokens.filter(token => token === '[UNK]').length;
        console.log(`[UNK] token count: ${unkCount}`);
        
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
        console.log(`❌ Error: ${error.message}`);
        return {
            model_name: modelName,
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log("=== Multilingual embedding model JavaScript test ===");
    
    try {
        // Test text
        const testText = "グラハム数";
        
        // Target test models (Xenova versions available)
        const modelsToTest = [
            // Original model (for comparison)
            'Xenova/all-MiniLM-L6-v2',
            
            // Multilingual models (Xenova versions)
            'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            'Xenova/distiluse-base-multilingual-cased',
            'Xenova/paraphrase-multilingual-mpnet-base-v2',
            
            // Other multilingual models
            'Xenova/multilingual-e5-small',
            'Xenova/multilingual-e5-base',
        ];
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            try {
                const result = await testModel(modelName, testText);
                results.push(result);
                
                if (result.success) {
                    console.log(`✅ ${modelName}: Success ([UNK]: ${result.unk_count})`);
                } else {
                    console.log(`❌ ${modelName}: Failed`);
                }
                
            } catch (error) {
                console.log(`❌ ${modelName}: Skipped - ${error.message}`);
                results.push({
                    model_name: modelName,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Compare results
        console.log(`\n=== Results comparison ===`);
        const successfulResults = results.filter(r => r.success);
        
        console.log(`Successful models: ${successfulResults.length}/${modelsToTest.length}`);
        
        if (successfulResults.length >= 1) {
            console.log(`\n--- [UNK] token count comparison ---`);
            for (const result of successfulResults) {
                const status = result.unk_count === 0 ? "🟢 Good" : `🔴 ${result.unk_count}`;
                console.log(`  ${result.model_name}: ${status}`);
            }
            
            // Recommend models with least UNK tokens
            const bestModels = successfulResults.filter(r => r.unk_count === 0);
            if (bestModels.length > 0) {
                console.log(`\n🎯 Recommended models (no [UNK]):`);
                for (const model of bestModels) {
                    console.log(`  - ${model.model_name}`);
                    console.log(`    Dimensions: ${model.embedding_dimension}`);
                    console.log(`    Token count: ${model.tokens.length}`);
                }
            } else {
                const minUnk = Math.min(...successfulResults.map(r => r.unk_count));
                const bestModels = successfulResults.filter(r => r.unk_count === minUnk);
                console.log(`\n🔶 Relatively good models ([UNK]: ${minUnk})`);
                for (const model of bestModels) {
                    console.log(`  - ${model.model_name}`);
                    console.log(`    Dimensions: ${model.embedding_dimension}`);
                }
            }
        }
        
        // Save results to JSON file
        const outputFile = path.join(__dirname, 'multilingual_test_results_js.json');
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
        
        console.log(`\nDetailed results saved: ${outputFile}`);
        
    } catch (error) {
        console.error('Error during multilingual model test:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}