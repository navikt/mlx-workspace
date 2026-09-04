import axios from 'axios';

const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function geocode(name) {
  try {
    const url = `https://ws.geonorge.no/stedsnavn/v1/sted?sok=${encodeURIComponent(name)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;

    if (!data.navn || data.navn.length === 0) {
      throw new Error(`Could not find location "${name}"`);
    }

    const firstResult = data.navn[0];
    const coords = firstResult.geojson.geometry.coordinates;
    // GeoJSON format is [lon, lat], swap to [lat, lon]
    const lat = coords[1];
    const lon = coords[0];

    // Use the first place name entry
    const placeName = firstResult.stedsnavn[0]?.skrivemåte || name;

    return { lat, lon, locationName: placeName };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geocoding API returned ${error.response.status}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Geocoding request timed out');
    }
    throw new Error(`Geocoding failed - ${error.message}`);
  }
}

export async function fetchWeather(lat, lon) {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 15000
    });

    const data = response.data;

    if (!data.properties || !data.properties.timeseries) {
      throw new Error('Invalid weather data response');
    }

    const timeseries = data.properties.timeseries;

    // Find closest timeseries entry to current time
    const now = new Date();
    let closest = timeseries[0];
    let closestDiff = Infinity;

    for (const entry of timeseries) {
      const entryTime = new Date(entry.time);
      const diff = Math.abs(entryTime - now);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = entry;
      }
    }

    const instant = closest.data.instant;
    if (!instant || !instant.details) {
      throw new Error('Weather data missing instant details');
    }

    const details = instant.details;

    // Derive description from cloud_area_fraction
    const cloudFraction = details.cloud_area_fraction;
    let description;
    if (cloudFraction > 75) {
      description = 'Overcast';
    } else if (cloudFraction > 50) {
      description = 'Partly cloudy';
    } else if (cloudFraction > 25) {
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
      uvIndex: details.ultraviolet_index_clear_sky
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('Met.no API rejected the request (403). Check User-Agent header.');
      } else if (error.response.status === 429) {
        throw new Error('Met.no API rate limited (429). Try again later.');
      } else {
        throw new Error(`Weather API returned ${error.response.status}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Weather request timed out');
    }
    throw new Error(`Weather fetch failed - ${error.message}`);
  }
}
