import axios from 'axios';

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

/**
 * Fetch weather data from Met.no and find the closest timeseries entry.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {{ temperature: number, humidity: number, windSpeed: number, pressure: number, uvIndex: number|null, cloudAreaFraction: number|null, time: string }}
 * @throws {Error} on API failure
 */
export async function fetchWeather(lat, lon) {
  const params = {
    lat,
    lon,
  };

  try {
    const response = await axios.get(MET_NO_URL, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 15000,
    });

    const data = response.data;

    if (!data.properties || !data.properties.timeseries || data.properties.timeseries.length === 0) {
      throw new Error('No weather data available');
    }

    const timeseries = data.properties.timeseries;

    // Find closest timeseries entry to current time (UTC)
    const now = new Date(Date.now());
    let closest = timeseries[0];
    let minDiff = Math.abs(new Date(timeseries[0].time).getTime() - now.getTime());

    for (let i = 1; i < timeseries.length; i++) {
      const diff = Math.abs(new Date(timeseries[i].time).getTime() - now.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = timeseries[i];
      }
    }

    const instant = closest.data?.instant;
    if (!instant || !instant.details) {
      throw new Error('No instant data available');
    }

    const details = instant.details;

    return {
      temperature: details.air_temperature,
      humidity: details.relative_humidity,
      windSpeed: details.wind_speed,
      pressure: details.air_pressure_at_sea_level,
      uvIndex: details.ultraviolet_index_clear_sky ?? null,
      cloudAreaFraction: details.cloud_area_fraction ?? null,
      time: closest.time,
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('Met.no API blocked access (403). Check your User-Agent header.');
      }
      if (error.response.status === 429) {
        throw new Error('Met.no API rate limited (429). Please wait and try again.');
      }
      throw new Error(`Met.no API error (${error.response.status}): ${error.response.statusText}`);
    }
    throw new Error(`Met.no request failed: ${error.message}`);
  }
}
