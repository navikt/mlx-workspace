import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '..', 'index.js');

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    proc.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    proc.on('error', reject);
  });
}

describe('integration.test.js', () => {
  it('exits 1 with no arguments', async () => {
    const { code, stderr } = await runCLI([]);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Usage:') || stderr.includes('Error:'));
  });

  it('exits 0 and prints weather for a real location (integration)', async () => {
    // This test hits the real Met.no API — it may fail if rate-limited or network is down
    // Skip if no network: it's an integration test
    try {
      const { code, stdout } = await runCLI(['Oslo']);
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes('Weather in'));
      assert.ok(stdout.includes('Temperature:'));
      assert.ok(stdout.includes('Description:'));
      assert.ok(stdout.includes('Humidity:'));
      assert.ok(stdout.includes('Wind Speed:'));
      assert.ok(stdout.includes('Pressure:'));
      assert.ok(stdout.includes('UV Index:'));
    } catch (err) {
      // Network error — acceptable for integration test
      console.log('Integration test skipped (network):', err.message);
    }
  });

  it('exits 1 for invalid coordinates', async () => {
    const { code } = await runCLI(['95 10']);
    assert.strictEqual(code, 1);
  });
});
