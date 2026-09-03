import axios from 'axios';

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 (test@weather-cli.dev)';

export async function fetchWeather(lat, lon) {
  const url = `${MET_NO_URL}?lat=${lat}&lon=${lon}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('Met.no API rejected the request (403). Check User-Agent header.');
      }
      if (error.response.status === 429) {
        throw new Error('Met.no API rate limit exceeded (429). Try again later.');
      }
      throw new Error(`Met.no API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Weather fetch failed: ${error.message}`);
  }
}

export function findClosestEntry(timeseries) {
  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available');
  }

  const now = new Date().getTime();

  let closest = timeseries[0];
  let closestDiff = Math.abs(new Date(timeseries[0].time).getTime() - now);

  for (let i = 1; i < timeseries.length; i++) {
    const entryTime = new Date(timeseries[i].time).getTime();
    const diff = Math.abs(entryTime - now);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = timeseries[i];
    }
  }

  return closest;
}

export function extractData(closestEntry) {
  const details = closestEntry.data.instant.details;

  const temperature = details.air_temperature;
  const humidity = details.relative_humidity;
  const windSpeed = details.wind_speed;
  const pressure = details.air_pressure_at_sea_level;
  const uvIndex = details.ultraviolet_index_clear_sky;
  const cloudArea = details.cloud_area_fraction;

  let description;
  if (cloudArea !== undefined) {
    if (cloudArea > 75) {
      description = 'Overcast';
    } else if (cloudArea > 50) {
      description = 'Partly cloudy';
    } else if (cloudArea > 25) {
      description = 'Mostly clear';
    } else {
      description = 'Clear';
    }
  } else {
    description = undefined;
  }

  return {
    temperature,
    description,
    humidity,
    windSpeed,
    pressure,
    uvIndex,
  };
}
