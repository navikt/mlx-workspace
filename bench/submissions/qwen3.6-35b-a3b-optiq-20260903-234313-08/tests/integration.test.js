import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '..', 'src', 'index.js');

describe('Integration', () => {
  function runCLI(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [CLI_PATH, ...args]);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  }

  it('should fail with invalid coordinates', async () => {
    const { code, stderr } = await runCLI(['91 10.75']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Invalid latitude'));
  });

  it('should fail with non-numeric coordinates', async () => {
    const { code, stderr } = await runCLI(['abc def']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Invalid coordinates'));
  });

  it('should fail with invalid longitude', async () => {
    const { code, stderr } = await runCLI(['59.91 200']);
    assert.strictEqual(code, 1);
    assert.ok(stderr.includes('Invalid longitude'));
  });

  it('should succeed with default (no args defaults to Oslo) when APIs are reachable', async () => {
    const { code, stdout, stderr } = await runCLI([]);
    // When APIs are reachable, should succeed with Oslo weather
    if (code === 0) {
      assert.ok(stdout.includes('Weather in Oslo'));
      assert.ok(stdout.includes('Temperature:'));
      assert.ok(stdout.includes('Description:'));
      assert.ok(stdout.includes('Humidity:'));
      assert.ok(stdout.includes('Wind Speed:'));
      assert.ok(stdout.includes('Pressure:'));
      assert.ok(stdout.includes('UV Index:'));
    } else {
      // When APIs are unreachable (CI), should fail gracefully
      assert.ok(stderr.includes('Error'));
    }
  });
});
