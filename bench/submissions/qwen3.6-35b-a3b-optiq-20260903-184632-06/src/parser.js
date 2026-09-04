import axios from 'axios';

const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export function parseLocation(arg) {
  if (arg === undefined || arg === null || arg === '') {
    return { type: 'name', value: 'Oslo' };
  }

  const coordMatch = arg.match(/^-?\d+(\.\d+)? -?\d+(\.\d+)?$/);
  if (coordMatch) {
    const parts = arg.split(/\s+/);
    return {
      type: 'coords',
      value: arg,
      lat: parseFloat(parts[0]),
      lon: parseFloat(parts[1]),
    };
  }

  return { type: 'name', value: arg };
}
