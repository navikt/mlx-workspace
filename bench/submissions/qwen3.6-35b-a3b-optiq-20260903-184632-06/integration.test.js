import assert from 'node:assert';
import { test } from 'node:test';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, 'index.js');

test('integration: default (no args) exits with code 0', async () => {
  const result = spawnSync(process.execPath, [CLI_PATH], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout;
  assert.ok(output.includes('Weather in'));
  assert.ok(output.includes('Temperature:'));
  assert.ok(output.includes('Description:'));
});

test('integration: valid location name exits with code 0', async () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'Bergen'], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout;
  assert.ok(output.includes('Weather in'));
  assert.ok(output.includes('Temperature:'));
  assert.ok(output.includes('Description:'));
});

test('integration: coordinates exit with code 0', async () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '59.91 10.75'], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout;
  assert.ok(output.includes('Weather in 59.91 10.75 (Met.no API)'));
  assert.ok(output.includes('Temperature:'));
  assert.ok(output.includes('Description:'));
});

test('integration: invalid location name exits with code 1', async () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'NoSuchPlaceXYZ12345'], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('Error'));
  assert.ok(result.stderr.includes('Location not found'));
});

test('integration: output contains all required fields', async () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'Oslo'], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout;
  assert.ok(output.includes('Weather in'));
  assert.ok(output.includes('Temperature:'));
  assert.ok(output.includes('Description:'));
  assert.ok(output.includes('Humidity:'));
  assert.ok(output.includes('Wind Speed:'));
  assert.ok(output.includes('Pressure:'));
});
