// browser.js - ブラウザ環境用のimportヘッダ

// External libraries from CDN
import { load as yamlLoad } from 'https://cdn.skypack.dev/js-yaml@4.1.0';
import pako from 'https://cdn.skypack.dev/pako@2.1.0';

// Dynamic import for transformers
let pipelineImport;
if (typeof window !== 'undefined') {
    // Browser environment
    pipelineImport = async () => {
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
        return { pipeline };
    };
} else {
    // Node.js environment (fallback)
    pipelineImport = () => Promise.reject(new Error('Browser headers used in Node.js environment'));
}

// Browser-specific globals
const alert = window.alert;

export { yamlLoad, pako, pipelineImport, alert };