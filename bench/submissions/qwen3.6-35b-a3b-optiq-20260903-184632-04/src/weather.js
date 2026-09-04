import axios from 'axios';

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

export async function fetchWeather(lat, lon, userAgent) {
  const url = `${MET_NO_URL}?lat=${lat}&lon=${lon}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      console.error(`Error: Met.no API returned ${response.status}`);
      process.exit(1);
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        console.error('Error: Access denied by Met.no API (403). Check User-Agent header.');
      } else if (error.response.status === 429) {
        console.error('Error: Met.no API rate limited (429). Please try again later.');
      } else {
        console.error(`Error: Met.no API returned ${error.response.status} - ${error.response.statusText}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('Error: Request to Met.no API timed out');
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export function findClosestTimeseries(timeseries, now) {
  const nowUTC = now.toISOString();

  let closest = timeseries[0];
  let closestDiff = Infinity;

  for (const ts of timeseries) {
    const tsTime = new Date(ts.time);
    const diff = Math.abs(tsTime.getTime() - now.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = ts;
    }
  }

  return closest;
}
