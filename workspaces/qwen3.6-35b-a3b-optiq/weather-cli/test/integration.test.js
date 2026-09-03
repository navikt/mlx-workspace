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

    it('should fetch weather for default location (Oslo)', async () => {
      try {
        const { stdout } = await execAsync('node cli.js');
        assert.ok(stdout.includes('Weather in Oslo'), 'Should show Oslo weather');
        assert.ok(stdout.includes('Temperature:'), 'Should show temperature');
      } catch (error) {
        assert.fail('Should succeed with default location: ' + error.message);
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
