import axios from 'axios';

/**
 * Fetch weather data from Met.no API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {{success: boolean, temperature?: number, humidity?: number, windSpeed?: number, pressure?: number, uvIndex?: number, cloudAreaFraction?: number, error?: string}}
 */
export async function fetchWeather(lat, lon) {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'weather-cli/1.0 github.com/navikt/weather-cli'
      },
      timeout: 15000
    });

    const data = response.data;

    // Find the closest timeseries entry to current time
    const currentTimestamp = new Date().toISOString();
    let closestEntry = null;
    let closestDiff = Infinity;

    if (data.timeseries && data.timeseries.length > 0) {
      for (const entry of data.timeseries) {
        const entryTime = new Date(entry.time).toISOString();
        const diff = Math.abs(
          new Date(entryTime).getTime() - new Date(currentTimestamp).getTime()
        );
        if (diff < closestDiff) {
          closestDiff = diff;
          closestEntry = entry;
        }
      }
    }

    if (!closestEntry) {
      return {
        success: false,
        error: 'No weather data available'
      };
    }

    // Extract weather details from instant details
    const instant = closestEntry.instant?.details;

    if (!instant) {
      return {
        success: false,
        error: 'No instant weather details available'
      };
    }

    return {
      success: true,
      temperature: instant.air_temperature,
      humidity: instant.relative_humidity,
      windSpeed: instant.wind_speed,
      pressure: instant.pressure,
      uvIndex: closestEntry.uv_index ? closestEntry.uv_index.max : 0,
      cloudAreaFraction: instant.cloud_area_low_fraction !== undefined ? instant.cloud_area_low_fraction : instant.cloud_area_medium_fraction !== undefined ? instant.cloud_area_medium_fraction : instant.cloud_area_high_fraction !== undefined ? instant.cloud_area_high_fraction : instant.cloud_area_fraction ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: `Weather API error: ${error.message}`
    };
  }
}
