const fetch = require('node-fetch');

async function testAuth() {
    console.log('Starting test...');
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    try {
        const res = await fetch('http://localhost:3000/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'mcp_sk_invalid'
            },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
            signal: controller.signal
        });

        console.log('Status:', res.status);
        console.log('Headers:', JSON.stringify(res.headers.raw(), null, 2));
        const body = await res.json();
        console.log('Body:', body);
        clearTimeout(timeout);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('Test FAILED: Request timed out (likely due to forced SSE)');
        } else {
            console.error('Test ERROR:', err.message);
        }
        process.exit(1);
    }
}

testAuth();
