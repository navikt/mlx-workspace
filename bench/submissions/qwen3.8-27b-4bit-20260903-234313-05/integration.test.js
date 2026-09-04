'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, 'weather-cli.js');

function runCli(args) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = execFile(process.execPath, [CLI, ...args]);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('CLI succeeds for a valid place name (live Geonorge + Met.no)', async () => {
  const { code, stdout, stderr } = await runCli(['Oslo']);
  assert.strictEqual(code, 0, `expected exit 0, got ${code}; stderr: ${stderr}`);
  assert.match(stdout, /^Weather in Oslo.* \(Met\.no API\)$/m);
  assert.match(stdout, /Temperature: -?\d+(\.\d+)?°C/);
  assert.match(stdout, /Description: (Overcast|Partly cloudy|Mostly clear|Clear)/);
  assert.match(stdout, /Humidity: -?\d+(\.\d+)?%/);
  assert.match(stdout, /Wind Speed: -?\d+(\.\d+)? m\/s/);
  assert.match(stdout, /Pressure: -?\d+(\.\d+)? hPa/);
  assert.match(stdout, /UV Index: -?\d+(\.\d+)?/);
}, { timeout: 30000 });

test('CLI succeeds for coordinates (live Met.no)', async () => {
  const { code, stdout, stderr } = await runCli(['59.91', '10.75']);
  assert.strictEqual(code, 0, `expected exit 0, got ${code}; stderr: ${stderr}`);
  assert.match(stdout, /^Weather in 59\.91 10\.75 \(Met\.no API\)$/m);
  assert.match(stdout, /Temperature: -?\d+(\.\d+)?°C/);
}, { timeout: 30000 });

test('CLI exits 1 on invalid coordinates', async () => {
  const { code, stderr } = await runCli(['95', '10']);
  assert.strictEqual(code, 1);
  assert.match(stderr, /Error:.*out of range/i);
});

test('CLI exits 1 on unknown place name (live Geonorge no-match)', async () => {
  const { code, stderr } = await runCli(['Xyzzyqwertz']);
  assert.strictEqual(code, 1);
  assert.match(stderr, /Error:.*no match/i);
}, { timeout: 30000 });

test('CLI exits 1 when no argument given', async () => {
  const { code, stderr } = await runCli([]);
  assert.strictEqual(code, 1);
  assert.match(stderr, /Error:.*Missing location/i);
});
