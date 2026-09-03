import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('integration', () => {
  describe('CLI with coordinates (no API call needed for parsing)', () => {
    it('should handle invalid coordinates with exit code 1', async () => {
      try {
        await execAsync('node cli.js "91 10"');
        assert.fail('Should have failed');
      } catch (error) {
        assert.equal(error.code, 1, 'Should exit with code 1');
        const combinedOutput = (error.stdout || '') + (error.stderr || '');
        assert.ok(combinedOutput.includes('Invalid latitude'), `Should mention invalid latitude, got: ${combinedOutput}`);
      }
    });

    it('should show usage for default location (will fail API call but parser works)', async () => {
      // This will fail at the API level since we can't make real calls in tests,
      // but the parser should work correctly
      try {
        await execAsync('node cli.js');
        assert.fail('Should have failed at API level');
      } catch (error) {
        // Expected to fail at API level, not at parsing level
        // The key is that parser didn't crash
        const combinedOutput = (error.stdout || '') + (error.stderr || '');
        assert.ok(combinedOutput.includes('Error:'), 'Should show error message');
      }
    });
  });

  describe('CLI with valid coordinates', () => {
    it('should attempt to fetch weather for valid coordinates', async () => {
      try {
        await execAsync('node cli.js 59.91 10.75');
        // If we get here, the API call succeeded - output should be formatted
      } catch (error) {
        // If API fails, we should still see proper error handling
        assert.equal(error.code, 1, 'Should exit with code 1 on error');
        const combinedOutput = (error.stdout || '') + (error.stderr || '');
        assert.ok(combinedOutput.includes('Error:'), 'Should show error message');
      }
    });
  });
});
