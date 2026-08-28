import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const cli = join(root, '..', 'index.js');

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

test('geocode + weather by name (live network)', { timeout: 30000 }, () => {
  const { code, stdout, stderr } = run(['Bergen']);
  assert.equal(code, 0, `exit ${code}: ${stderr}`);
  const lines = stdout.trim().split('\n');
  assert.equal(lines.length, 7);
  assert.match(lines[0], /^Weather in .+ \(Met\.no API\)$/);
  assert.match(lines[1], /^Temperature: -?\d+(\.\d+)?°C$/);
  assert.match(lines[2], /^Description: (Overcast|Partly cloudy|Mostly clear|Clear)$/);
  assert.match(lines[3], /^Humidity: \d+(\.\d+)?%$/);
  assert.match(lines[4], /^Wind Speed: \d+(\.\d+)? m\/s$/);
  assert.match(lines[5], /^Pressure: \d+(\.\d+)? hPa$/);
  assert.match(lines[6], /^UV Index: \d+(\.\d+)?$/);
});

test('weather by coordinates (live network)', { timeout: 30000 }, () => {
  const { code, stdout, stderr } = run(['59.91 10.75']);
  assert.equal(code, 0, `exit ${code}: ${stderr}`);
  assert.match(stdout, /^Weather in 59\.91 10\.75 \(Met\.no API\)$/m);
});

test('invalid coordinates exit 1', () => {
  const { code, stderr } = run(['999 999']);
  assert.equal(code, 1);
  assert.match(stderr, /Invalid coordinates/);
});

test('unknown place name exits 1', { timeout: 30000 }, () => {
  const { code, stderr } = run(['xyzzyqxyzzy']);
  assert.equal(code, 1);
  assert.match(stderr, /No place found/);
});

test('missing argument exits 1', () => {
  const { code, stderr } = run([]);
  assert.equal(code, 1);
  assert.match(stderr, /No location given/);
});
