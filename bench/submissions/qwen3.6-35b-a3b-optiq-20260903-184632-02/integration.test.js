import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, 'weather.mjs');

function runCLI(input) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, ...input.split(' ')], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    proc.on('error', reject);
  });
}

describe('integration.js', () => {
  it('exits with code 1 when no arguments provided', async () => {
    const result = await new Promise((resolve, reject) => {
      const proc = spawn('node', [CLI_PATH], {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      proc.on('close', (code) => { resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }); });
      proc.on('error', reject);
    });
    assert.strictEqual(result.code, 1, 'Should exit with code 1 when no args');
    assert.ok(result.stderr.includes('Usage'), 'Should show usage message');
  });

  it('exits with code 1 for invalid coordinates', async () => {
    const result = await runCLI('999 999');
    assert.strictEqual(result.code, 1, 'Should exit with code 1 for invalid coords');
    assert.ok(result.stderr.includes('Invalid') || result.stderr.includes('Error'), 'Should show error message');
  });

  it('outputs weather data for Oslo coordinates (59.91 10.75)', async () => {
    const result = await runCLI('59.91 10.75');
    assert.strictEqual(result.code, 0, 'Should exit with code 0 on success');
    assert.ok(result.stdout.includes('Weather in'), 'Should include location header');
    assert.ok(result.stdout.includes('Temperature:'), 'Should include temperature');
    assert.ok(result.stdout.includes('Description:'), 'Should include description');
    assert.ok(result.stdout.includes('Humidity:'), 'Should include humidity');
    assert.ok(result.stdout.includes('Wind Speed:'), 'Should include wind speed');
    assert.ok(result.stdout.includes('Pressure:'), 'Should include pressure');
    assert.ok(result.stdout.includes('UV Index:'), 'Should include UV index');
    assert.ok(result.stdout.includes('°C'), 'Should include degree symbol');
    assert.ok(result.stdout.includes('m/s'), 'Should include wind speed unit');
    assert.ok(result.stdout.includes('hPa'), 'Should include pressure unit');
  }, 30000);

  it('geocodes and outputs weather for "Oslo" location name', async () => {
    const result = await runCLI('Oslo');
    assert.strictEqual(result.code, 0, 'Should exit with code 0 on success');
    assert.ok(result.stdout.includes('Weather in'), 'Should include location header');
    assert.ok(result.stdout.includes('Temperature:'), 'Should include temperature');
    assert.ok(result.stdout.includes('Description:'), 'Should include description');
  }, 30000);
});
