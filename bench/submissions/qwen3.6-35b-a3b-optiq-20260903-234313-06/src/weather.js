import axios from 'axios';

const MET_NO_API = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 test@example.com';

/**
 * Fetch weather data from Met.no API.
 * Returns parsed weather data from the closest timeseries entry to current time.
 */
export async function fetchWeather(lat, lon) {
  const url = `${MET_NO_API}?lat=${lat}&lon=${lon}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    const data = response.data;

    if (!data.properties || !data.properties.timeseries) {
      throw new Error('Met.no API response missing expected data structure');
    }

    const timeseries = data.properties.timeseries;

    // Find closest timeseries entry to current time
    const now = new Date();
    let closestEntry = timeseries[0];
    let closestDiff = Math.abs(new Date(timeseries[0].time) - now);

    for (let i = 1; i < timeseries.length; i++) {
      const diff = Math.abs(new Date(timeseries[i].time) - now);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestEntry = timeseries[i];
      }
    }

    const details = closestEntry.data.instant.details;

    if (!details) {
      throw new Error('Met.no API response missing instant.details');
    }

    // Derive description from cloud_area_fraction
    const cloudCover = details.cloud_area_fraction;
    let description;
    if (cloudCover > 75) {
      description = 'Overcast';
    } else if (cloudCover > 50) {
      description = 'Partly cloudy';
    } else if (cloudCover > 25) {
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
        throw new Error('Met.no API rejected request (403). Check User-Agent header.');
      }
      if (error.response.status === 429) {
        throw new Error('Met.no API rate limited (429). Try again later.');
      }
      throw new Error(`Met.no API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Met.no API request failed: ${error.message}`);
  }
}
