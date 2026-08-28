import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../src/index.js', import.meta.url));
const opts = { timeout: 30000 };

function assertWeatherBlock(stdout) {
  assert.match(stdout, /^Weather in .+ \(Met\.no API\)$/m);
  assert.match(stdout, /^Temperature: -?\d+(\.\d+)?°C$/m);
  assert.match(stdout, /^Description: (Clear|Mostly clear|Partly cloudy|Overcast)$/m);
  assert.match(stdout, /^Humidity: \d+(\.\d+)?%$/m);
  assert.match(stdout, /^Wind Speed: \d+(\.\d+)? m\/s$/m);
  assert.match(stdout, /^Pressure: \d+(\.\d+)? hPa$/m);
  assert.match(stdout, /^UV Index: \d+(\.\d+)?$/m);
}

test('weather Oslo (real Geonorge + Met.no APIs)', async () => {
  const { stdout } = await run(process.execPath, [cli, 'Oslo'], opts);
  assert.match(stdout, /^Weather in Oslo/);
  assertWeatherBlock(stdout);
});

test('weather by coordinates (real Met.no API)', async () => {
  const { stdout } = await run(process.execPath, [cli, '59.91', '10.75'], opts);
  assert.match(stdout, /^Weather in 59\.91 10\.75 \(Met\.no API\)$/m);
  assertWeatherBlock(stdout);
});

test('unknown location exits 1', async () => {
  await assert.rejects(
    run(process.execPath, [cli, 'Xyzzyqq123'], opts),
    (err) => err.code === 1 && /not found/i.test(err.stderr),
  );
});

test('invalid coordinates exit 1', async () => {
  await assert.rejects(
    run(process.execPath, [cli, '999', '10'], opts),
    (err) => err.code === 1 && /Invalid coordinates/.test(err.stderr),
  );
});

test('missing location exits 1', async () => {
  await assert.rejects(
    run(process.execPath, [cli], opts),
    (err) => err.code === 1 && /Usage/.test(err.stderr),
  );
});
