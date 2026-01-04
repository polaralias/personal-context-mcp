const { validateApiKey } = require('./src/services/auth');
const crypto = require('crypto');

process.env.MCP_API_KEY = 'test-key';
process.env.MCP_API_KEYS = 'key1, key2';

console.log('Testing validateApiKey:');
console.log('test-key:', validateApiKey('test-key')); // true
console.log('key1:', validateApiKey('key1')); // true
console.log('key2:', validateApiKey('key2')); // true
console.log('wrong:', validateApiKey('wrong')); // false
console.log('empty:', validateApiKey('')); // false
