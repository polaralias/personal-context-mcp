import crypto from 'crypto';
import { getMasterKeyBytes } from './src/utils/masterKey';

async function runTests() {
    console.log('--- Starting Master Key Derivation Logic Verification ---');
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        } else {
            console.error(`[FAIL] ${message}`);
            failed++;
        }
    }

    // 1. Missing MASTER_KEY
    try {
        delete process.env.MASTER_KEY;
        getMasterKeyBytes();
        assert(false, 'Should throw if MASTER_KEY is missing');
    } catch (e: any) {
        assert(e.message.includes('missing or empty'), 'Should throw if MASTER_KEY is missing');
    }

    // 2. 64 hex characters
    const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.MASTER_KEY = hexKey;
    const bytesHex = getMasterKeyBytes();
    assert(bytesHex.length === 32, 'Hex key should result in 32 bytes');
    assert(bytesHex.toString('hex') === hexKey, 'Hex key should be decoded correctly');

    // 3. Passphrase
    const passphrase = 'my-secret-passphrase';
    process.env.MASTER_KEY = passphrase;
    const bytesPass = getMasterKeyBytes();
    const expectedPass = crypto.createHash('sha256').update(passphrase).digest();
    assert(bytesPass.length === 32, 'Passphrase should result in 32 bytes');
    assert(bytesPass.equals(expectedPass), 'Passphrase should be derived using SHA-256');

    // 4. Whitespace trimming
    process.env.MASTER_KEY = '  ' + hexKey + '  ';
    const bytesTrimmed = getMasterKeyBytes();
    assert(bytesTrimmed.toString('hex') === hexKey, 'Should trim whitespace from hex keys');

    console.log(`\n--- Verification Summary: ${passed} Passed, ${failed} Failed ---`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
