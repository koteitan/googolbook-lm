// nodejs-header.js - Import header for Node.js environment

import { load as yamlLoad } from 'js-yaml';
import pako from 'pako';
import { pipeline } from '@xenova/transformers';

// Node.js environment pipeline implementation
const pipelineImport = () => Promise.resolve({ pipeline });

// Node.js alert implementation
const alert = (msg) => console.log("[alert]", msg);

export { yamlLoad, pako, pipelineImport, alert };