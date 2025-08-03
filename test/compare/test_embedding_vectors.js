#!/usr/bin/env node
/**
 * Detailed comparison of embedding vectors - Input layer (Token IDs) and output layer (Embedding)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.log(`\n=== Model: ${modelName} ===`);
    
    try {
        // Dynamic import of Transformers.js
        const { pipeline, AutoTokenizer } = await import('@xenova/transformers');
        
        // Initialize Embedder and Tokenizer
        const embedder = await pipeline('feature-extraction', modelName);
        const tokenizer = await AutoTokenizer.from_pretrained(modelName);
        
        const results = [];
        
        for (let i = 0; i < testTexts.length; i++) {
            const text = testTexts[i];
            console.log(`\n--- Text ${i+1}: '${text}' ---`);
            
            // 1. Token IDs (Input layer)
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
            
            // 2. Embedding (Output layer)
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
        console.log(`❌ Error: ${error.message}`);
        return {
            model_name: modelName,
            success: false,
            error: error.message
        };
    }
}

function compareEmbeddingsBetweenTexts(results, modelName) {
    console.log(`\n=== ${modelName} - Inter-text comparison ===`);
    
    const embeddings = results.map(r => r.embedding);
    const texts = results.map(r => r.text);
    
    // Pairwise comparison
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
            const cosineSim = cosineSimilarity(embeddings[i], embeddings[j]);
            const euclideanDist = euclideanDistance(embeddings[i], embeddings[j]);
            
            console.log(`'${texts[i]}' vs '${texts[j]}':`);
            console.log(`  Cosine similarity: ${cosineSim.toFixed(6)}`);
            console.log(`  Euclidean distance: ${euclideanDist.toFixed(6)}`);
        }
    }
}

function compareTokenIdsBetweenModels(pyResults, jsResults) {
    console.log(`\n=== Token IDs comparison (Python vs JavaScript) ===`);
    
    for (let i = 0; i < pyResults.length; i++) {
        const text = pyResults[i].text;
        const pyTokens = pyResults[i].token_ids;
        const jsTokens = jsResults[i].token_ids;
        
        console.log(`\nText ${i+1}: '${text}'`);
        console.log(`Python Token IDs:     [${pyTokens.join(', ')}]`);
        console.log(`JavaScript Token IDs: [${jsTokens.join(', ')}]`);
        
        // Consistency of Token IDs
        if (JSON.stringify(pyTokens) === JSON.stringify(jsTokens)) {
            console.log(`✅ Token IDs match`);
        } else {
            console.log(`❌ Token IDs mismatch`);
            console.log(`   Length: Python=${pyTokens.length}, JavaScript=${jsTokens.length}`);
            
            // Details of differences
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
                console.log(`   Difference positions: ${differences.length} locations`);
                for (let k = 0; k < Math.min(differences.length, 5); k++) {
                    const [pos, pyId, jsId] = differences[k];
                    console.log(`     Position ${pos}: Python=${pyId}, JavaScript=${jsId}`);
                }
            }
        }
    }
}

function compareEmbeddingsBetweenModels(pyResults, jsResults) {
    console.log(`\n=== Embedding comparison (Python vs JavaScript) ===`);
    
    for (let i = 0; i < pyResults.length; i++) {
        const text = pyResults[i].text;
        const pyEmbedding = pyResults[i].embedding;
        const jsEmbedding = jsResults[i].embedding;
        
        console.log(`\nText ${i+1}: '${text}'`);
        console.log(`Python Embedding L2 norm:     ${pyResults[i].embedding_norm.toFixed(6)}`);
        console.log(`JavaScript Embedding L2 norm: ${jsResults[i].embedding_norm.toFixed(6)}`);
        
        // Dimension consistency
        if (pyEmbedding.length === jsEmbedding.length) {
            console.log(`✅ Dimensions match: [${pyEmbedding.length}]`);
            
            // Cosine similarity
            const cosineSim = cosineSimilarity(pyEmbedding, jsEmbedding);
            console.log(`Cosine similarity: ${cosineSim.toFixed(6)}`);
            
            // Euclidean distance
            const euclideanDist = euclideanDistance(pyEmbedding, jsEmbedding);
            console.log(`Euclidean distance: ${euclideanDist.toFixed(6)}`);
            
            // Element-level comparison (first and last 5 elements)
            console.log(`Python (first 5):     [${pyEmbedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`JavaScript (first 5):  [${jsEmbedding.slice(0, 5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`Python (last 5):      [${pyEmbedding.slice(-5).map(x => x.toFixed(6)).join(', ')}]`);
            console.log(`JavaScript (last 5):   [${jsEmbedding.slice(-5).map(x => x.toFixed(6)).join(', ')}]`);
            
            // Statistical metrics
            const absDiffs = pyEmbedding.map((val, idx) => Math.abs(val - jsEmbedding[idx]));
            const maxAbsDiff = Math.max(...absDiffs);
            const meanAbsDiff = absDiffs.reduce((sum, diff) => sum + diff, 0) / absDiffs.length;
            
            console.log(`Maximum absolute difference: ${maxAbsDiff.toFixed(6)}`);
            console.log(`Mean absolute difference: ${meanAbsDiff.toFixed(6)}`);
            
        } else {
            console.log(`❌ Dimension mismatch: Python=[${pyEmbedding.length}], JavaScript=[${jsEmbedding.length}]`);
        }
    }
}

async function loadPythonResults() {
    try {
        const filePath = path.join(__dirname, 'embedding_vectors_python.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.log(`⚠️ Python results file not found: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log("=== Embedding vector detailed comparison test (JavaScript version) ===");
    
    try {
        // Test texts
        const testTexts = [
            "グラハム数",
            "巨大数は、気の遠くなるほど大きな有限の数である。",
            "Hello World",  // English (baseline)
            "数学",  // Short Japanese
        ];
        
        console.log(`Test texts:`);
        testTexts.forEach((text, i) => {
            console.log(`  ${i+1}. '${text}'`);
        });
        
        // Target test model (highest accuracy mpnet)
        const modelName = 'Xenova/paraphrase-multilingual-mpnet-base-v2';
        
        // JavaScript version test
        console.log(`\n${'='.repeat(60)}`);
        console.log(`JavaScript version test`);
        console.log(`${'='.repeat(60)}`);
        const jsModelResult = await testEmbeddingVectors(modelName, testTexts);
        
        if (jsModelResult.success) {
            compareEmbeddingsBetweenTexts(jsModelResult.results, `JavaScript ${modelName}`);
        }
        
        // Save results to JSON file
        const outputFile = path.join(__dirname, 'embedding_vectors_javascript.json');
        fs.writeFileSync(outputFile, JSON.stringify({
            test_texts: testTexts,
            model_result: jsModelResult
        }, null, 2), 'utf-8');
        
        console.log(`\nJavaScript results saved: ${outputFile}`);
        
        // Comparison with Python results
        const pythonData = await loadPythonResults();
        if (pythonData && pythonData.model_result.success && jsModelResult.success) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Python vs JavaScript comparison`);
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

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}