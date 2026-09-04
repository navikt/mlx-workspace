import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseArgs } from '../src/parser.js';

describe('Parser', () => {
  it('should return location string when provided', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'weather', 'Oslo'];
    try {
      const result = parseArgs();
      assert.strictEqual(result, 'Oslo');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('should return coordinates string when provided', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'weather', '59.91 10.75'];
    try {
      const result = parseArgs();
      assert.strictEqual(result, '59.91 10.75');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('should trim whitespace from location', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'weather', '  Oslo  '];
    try {
      const result = parseArgs();
      assert.strictEqual(result, 'Oslo');
    } finally {
      process.argv = originalArgv;
    }
  });

  it('should exit with code 1 when no location provided', () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    let exitCode = null;

    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit');
    };

    try {
      parseArgs();
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    } finally {
      process.argv = originalArgv;
      process.exit = originalExit;
    }
  });
});
