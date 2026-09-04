import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pexec = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/index.js', import.meta.url));

function run(args) {
  return pexec(process.execPath, [CLI, ...args]).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (err) => ({ code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }),
  );
}

test('name path: geocode + weather + format (live)', async () => {
  const { code, stdout, stderr } = await run(['Oslo']);
  assert.equal(code, 0, `stderr: ${stderr}`);
  // Geonorge's top fuzzy match for "Oslo" is the county, whose primary name is "Oslo fylke"
  assert.match(stdout, /^Weather in Oslo fylke \(Met\.no API\)$/m);
  assert.match(stdout, /Temperature: -?\d+(\.\d+)?°C/);
  assert.match(stdout, /Description: (Overcast|Partly cloudy|Mostly clear|Clear)/);
  assert.match(stdout, /Humidity: \d+(\.\d+)?%/);
  assert.match(stdout, /Wind Speed: \d+(\.\d+)? m\/s/);
  assert.match(stdout, /Pressure: \d+(\.\d+)? hPa/);
  assert.match(stdout, /UV Index: \d+(\.\d+)?/);
}, 30000);

test('coordinate path skips geocoding (live)', async () => {
  const { code, stdout } = await run(['59.91 10.75']);
  assert.equal(code, 0);
  assert.match(stdout, /^Weather in 59\.91 10\.75 \(Met\.no API\)$/m);
  assert.match(stdout, /Temperature: /);
}, 30000);

test('missing location exits 1', async () => {
  const { code, stderr } = await run([]);
  assert.equal(code, 1);
  assert.match(stderr, /location required/);
});

test('invalid coordinates exit 1', async () => {
  const { code, stderr } = await run(['999 10']);
  assert.equal(code, 1);
  assert.match(stderr, /invalid latitude/);
});

test('unknown place exits 1 (live geocode miss)', async () => {
  const { code, stderr } = await run(['ZzqqxxNonexistent42']);
  assert.equal(code, 1);
  assert.match(stderr, /no match/);
}, 30000);
