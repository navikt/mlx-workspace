import { describe, it } from 'node:test';
import assert from 'node:assert';
import { findClosestTimeseries } from '../src/weather.js';

describe('Closest Timeseries', () => {
  it('should find the closest timeseries entry to current time', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const timeseries = [
      { time: '2024-01-15T10:00:00Z' },
      { time: '2024-01-15T11:00:00Z' },
      { time: '2024-01-15T12:00:00Z' },
      { time: '2024-01-15T13:00:00Z' },
    ];

    const closest = findClosestTimeseries(timeseries, now);
    assert.strictEqual(closest.time, '2024-01-15T12:00:00Z');
  });

  it('should find the closest entry when exact match does not exist', () => {
    const now = new Date('2024-01-15T12:30:00Z');
    const timeseries = [
      { time: '2024-01-15T10:00:00Z' },
      { time: '2024-01-15T12:00:00Z' },
      { time: '2024-01-15T13:00:00Z' },
    ];

    const closest = findClosestTimeseries(timeseries, now);
    // 12:30 is 30min from 12:00 and 30min from 13:00, should pick first one found
    assert.ok(['2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'].includes(closest.time));
  });

  it('should handle single entry', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const timeseries = [
      { time: '2024-01-15T12:00:00Z' },
    ];

    const closest = findClosestTimeseries(timeseries, now);
    assert.strictEqual(closest.time, '2024-01-15T12:00:00Z');
  });

  it('should work with UTC time comparison', () => {
    // Simulate local timezone (UTC+1)
    const localTime = new Date('2024-01-15T13:00:00+01:00'); // This is 12:00 UTC
    const timeseries = [
      { time: '2024-01-15T10:00:00Z' },
      { time: '2024-01-15T12:00:00Z' },
      { time: '2024-01-15T14:00:00Z' },
    ];

    const closest = findClosestTimeseries(timeseries, localTime);
    assert.strictEqual(closest.time, '2024-01-15T12:00:00Z');
  });
});
