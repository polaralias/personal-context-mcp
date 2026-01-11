const fetch = require('node-fetch');

async function testAuth() {
    const res = await fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'mcp_sk_invalid'
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
    });

    console.log('Status:', res.status);
    console.log('Body:', await res.json());
}

testAuth();
