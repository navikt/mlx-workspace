import assert from 'node:assert';
import { test } from 'node:test';
import { deriveDescription, formatOutput } from './src/output.js';

test('deriveDescription: cloud > 75 is Overcast', () => {
  assert.strictEqual(deriveDescription(76), 'Overcast');
  assert.strictEqual(deriveDescription(100), 'Overcast');
});

test('deriveDescription: cloud exactly 75 is Partly cloudy', () => {
  assert.strictEqual(deriveDescription(75), 'Partly cloudy');
});

test('deriveDescription: cloud > 50 is Partly cloudy', () => {
  assert.strictEqual(deriveDescription(51), 'Partly cloudy');
  assert.strictEqual(deriveDescription(74.9), 'Partly cloudy');
});

test('deriveDescription: cloud exactly 50 is mostly clear', () => {
  assert.strictEqual(deriveDescription(50), 'mostly clear');
});

test('deriveDescription: cloud > 25 is mostly clear', () => {
  assert.strictEqual(deriveDescription(26), 'mostly clear');
  assert.strictEqual(deriveDescription(49.9), 'mostly clear');
});

test('deriveDescription: cloud exactly 25 is Clear', () => {
  assert.strictEqual(deriveDescription(25), 'Clear');
});

test('deriveDescription: cloud <= 25 is Clear', () => {
  assert.strictEqual(deriveDescription(0), 'Clear');
  assert.strictEqual(deriveDescription(24), 'Clear');
});

test('deriveDescription: null cloud throws', () => {
  assert.throws(() => deriveDescription(null), Error);
});

test('formatOutput includes all fields without UV', () => {
  const weather = {
    temperature: 15.3,
    humidity: 75.8,
    windSpeed: 3.2,
    pressure: 1000.7,
    uvIndex: null,
    cloudArea: 50.0,
  };

  const output = formatOutput('Oslo', weather);
  assert.ok(output.includes('Weather in Oslo (Met.no API)'));
  assert.ok(output.includes('Temperature: 15.3°C'));
  assert.ok(output.includes('Description: mostly clear'));
  assert.ok(output.includes('Humidity: 75.8%'));
  assert.ok(output.includes('Wind Speed: 3.2 m/s'));
  assert.ok(output.includes('Pressure: 1000.7 hPa'));
  assert.ok(!output.includes('UV Index'));
});

test('formatOutput includes UV Index when present', () => {
  const weather = {
    temperature: 15.3,
    humidity: 75.8,
    windSpeed: 3.2,
    pressure: 1000.7,
    uvIndex: 2.8,
    cloudArea: 86.0,
  };

  const output = formatOutput('Bergen', weather);
  assert.ok(output.includes('Weather in Bergen (Met.no API)'));
  assert.ok(output.includes('Temperature: 15.3°C'));
  assert.ok(output.includes('Description: Overcast'));
  assert.ok(output.includes('UV Index: 2.8'));
});

test('formatOutput uses degree symbol correctly', () => {
  const weather = {
    temperature: 20,
    humidity: 60,
    windSpeed: 5,
    pressure: 1013,
    uvIndex: null,
    cloudArea: 10,
  };

  const output = formatOutput('Test', weather);
  assert.ok(output.includes('\u00B0C'));
});

test('formatOutput: description for Overcast', () => {
  const output = formatOutput('Test', {
    temperature: 10, humidity: 80, windSpeed: 3, pressure: 1000,
    uvIndex: 0, cloudArea: 90,
  });
  assert.ok(output.includes('Description: Overcast'));
});

test('formatOutput: description for Clear', () => {
  const output = formatOutput('Test', {
    temperature: 20, humidity: 40, windSpeed: 1, pressure: 1013,
    uvIndex: 5, cloudArea: 5,
  });
  assert.ok(output.includes('Description: Clear'));
});
