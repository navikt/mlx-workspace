const { parseArgs } = require('./parser');

describe('parseArgs', () => {
  test('returns none when no location is provided', () => {
    expect(parseArgs([])).toEqual({ type: 'none' });
  });

  test('parses coordinates correctly', () => {
    expect(parseArgs(['59.91 10.75'])).toEqual({ type: 'coords', lat: 59.91, lon: 10.75 });
    expect(parseArgs(['-34.60 -58.38'])).toEqual({ type: 'coords', lat: -34.60, lon: -58.38 });
  });

  test('parses location name correctly', () => {
    expect(parseArgs(['Oslo'])).toEqual({ type: 'name', name: 'Oslo' });
    expect(parseArgs(['Bergen'])).toEqual({ type: 'name', name: 'Bergen' });
  });

  test('treats coordinates with too many parts as a name', () => {
    expect(parseArgs(['59.91 10.75 100'])).toEqual({ type: 'name', name: '59.91 10.75 100' });
  });
});
