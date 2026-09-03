"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");

const CLI = path.join(__dirname, "..", "src", "index.js");

function runCli(args) {
  return new Promise((resolve) => {
    execFile("node", [CLI, ...args], (err, stdout, stderr) => {
      resolve({
        code: err ? err.code : 0,
        stdout,
        stderr,
      });
    });
  });
}

test("invalid coordinates exit 1 with an error", async () => {
  const r = await runCli(["95 10"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Error:/);
});

test("no argument exits 1 with an error", async () => {
  const r = await runCli([]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Error:/);
});

test("live: geocode Oslo and print the spec block", { timeout: 30000 }, async () => {
  const r = await runCli(["Oslo"]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const lines = r.stdout.split("\n").filter(Boolean);
  // Geonorge's prioritized skrivemåte for the "Oslo" match is "Oslo fylke".
  assert.match(lines[0], /^Weather in Oslo( fylke)? \(Met\.no API\)$/);
  assert.match(r.stdout, /Temperature: -?\d+(\.\d+)?°C/);
  assert.match(r.stdout, /Description: (Overcast|Partly cloudy|Mostly clear|Clear)/);
  assert.match(r.stdout, /Humidity: \d+(\.\d+)?%/);
  assert.match(r.stdout, /Wind Speed: \d+(\.\d+)? m\/s/);
  assert.match(r.stdout, /Pressure: \d+(\.\d+)? hPa/);
  assert.ok(!r.stdout.includes("undefined"));
});

test("live: coordinate input prints the spec block", { timeout: 30000 }, async () => {
  const r = await runCli(["59.91 10.75"]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /^Weather in 59\.91 10\.75 \(Met\.no API\)$/m);
  assert.match(r.stdout, /Temperature: -?\d+(\.\d+)?°C/);
  assert.ok(!r.stdout.includes("undefined"));
});
