import axios from 'axios';

const METNO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function fetchWeather(lat, lon, now = new Date()) {
  const params = { lat, lon };

  try {
    const response = await axios.get(METNO_URL, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    const timeseries = response.data.properties.timeseries;

    if (!timeseries || timeseries.length === 0) {
      throw new Error('No weather data available');
    }

    let closest = timeseries[0];
    let closestDiff = Math.abs(new Date(timeseries[0].time) - now);

    for (let i = 1; i < timeseries.length; i++) {
      const diff = Math.abs(new Date(timeseries[i].time) - now);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = timeseries[i];
      }
    }

    const details = closest.data.instant.details;
    const cloudAreaFraction = details.cloud_area_fraction;

    let description;
    if (cloudAreaFraction > 75) {
      description = 'Overcast';
    } else if (cloudAreaFraction > 50) {
      description = 'Partly cloudy';
    } else if (cloudAreaFraction > 25) {
      description = 'Mostly clear';
    } else {
      description = 'Clear';
    }

    return {
      temperature: details.air_temperature,
      description,
      humidity: details.relative_humidity,
      windSpeed: details.wind_speed,
      pressure: details.air_pressure_at_sea_level,
      uvIndex: details.ultraviolet_index_clear_sky,
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('Met.no API rejected request: 403 Forbidden. Check User-Agent header.');
      }
      if (error.response.status === 429) {
        throw new Error('Met.no API rate limited: 429 Too Many Requests.');
      }
      throw new Error(`Met.no API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Met.no weather fetch failed: ${error.message}`);
  }
}
