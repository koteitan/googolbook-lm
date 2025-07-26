/**
 * Japanese Morphological Analyzer - Common library for browser and Node.js
 * Using TinySegmenter for lightweight Japanese tokenization
 */

// TinySegmenter implementation
class TinySegmenter {
    constructor() {
        // Compact patterns for Japanese segmentation
        this.patterns = {
            // Character type patterns
            hiragana: /[\u3041-\u3096]/,
            katakana: /[\u30A1-\u30F6]/,
            kanji: /[\u4E00-\u9FAF]/,
            latin: /[A-Za-z]/,
            digit: /[0-9]/
        };
    }

    segment(text) {
        if (!text || text.length === 0) return [];
        
        const result = [];
        let current = '';
        let lastType = null;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const type = this.getCharType(char);

            if (lastType === null) {
                current = char;
                lastType = type;
            } else if (type === lastType || this.shouldCombine(lastType, type)) {
                current += char;
            } else {
                if (current.trim()) result.push(current);
                current = char;
                lastType = type;
            }
        }

        if (current.trim()) result.push(current);
        return result;
    }

    getCharType(char) {
        if (this.patterns.hiragana.test(char)) return 'hiragana';
        if (this.patterns.katakana.test(char)) return 'katakana';
        if (this.patterns.kanji.test(char)) return 'kanji';
        if (this.patterns.latin.test(char)) return 'latin';
        if (this.patterns.digit.test(char)) return 'digit';
        return 'other';
    }

    shouldCombine(type1, type2) {
        // Combine hiragana with kanji (common Japanese patterns)
        if ((type1 === 'kanji' && type2 === 'hiragana') ||
            (type1 === 'hiragana' && type2 === 'kanji')) {
            return true;
        }
        // Combine consecutive latin chars and digits
        if ((type1 === 'latin' && type2 === 'digit') ||
            (type1 === 'digit' && type2 === 'latin')) {
            return true;
        }
        return false;
    }
}

// Japanese morphological analyzer class
export class JapaneseMorphologicalAnalyzer {
    constructor() {
        this.tokenizer = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🔤 Initializing TinySegmenter for Japanese morphological analysis...');
            
            this.tokenizer = new TinySegmenter();
            this.initialized = true;
            
            console.log('✅ TinySegmenter initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize TinySegmenter:', error);
            throw error;
        }
    }

    tokenize(text) {
        if (!this.tokenizer) {
            console.warn('⚠ TinySegmenter not initialized, returning original text');
            return text;
        }

        try {
            // Tokenize with TinySegmenter
            const tokens = this.tokenizer.segment(text);
            const result = tokens.join(' ');
            
            console.log(`🔤 Tokenized: "${text}" → "${result}"`);
            return result;
        } catch (error) {
            console.error('❌ Tokenization failed:', error);
            return text;
        }
    }

    getDetailedTokens(text) {
        if (!this.tokenizer) {
            console.warn('⚠ TinySegmenter not initialized');
            return [];
        }

        try {
            const tokens = this.tokenizer.segment(text);
            // Return in a format similar to kuromoji for compatibility
            return tokens.map((token, i) => ({
                surface_form: token,
                pos: this.tokenizer.getCharType(token[0]),
                reading: token, // TinySegmenter doesn't provide readings
                index: i
            }));
        } catch (error) {
            console.error('❌ Detailed tokenization failed:', error);
            return [];
        }
    }
}

// Global instance for shared use
export const globalMorphAnalyzer = new JapaneseMorphologicalAnalyzer();