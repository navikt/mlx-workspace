import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

/**
 * Geocode a location name using Geonorge API.
 * Returns { lat, lon } in WGS84 (4258 coordsys, converted to decimal degrees).
 * Throws on failure.
 */
export async function geocodeLocation(name) {
  try {
    const response = await axios.get(GEONORGE_URL, {
      params: {
        sok: name,
        fuzzy: true,
        treffPerSide: 1,
        utkoordsys: '4258',
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    if (!response.data || !response.data.navn || response.data.navn.length === 0) {
      throw new Error(`No results found for location: ${name}`);
    }

    const resultat = response.data.navn[0];

    // Geonorge returns WGS84 coordinates when utkoordsys=4258 is specified
    // representasjonspunkt has 'nord' (lat) and 'øst' (lon)
    const lat = resultat.representasjonspunkt?.nord;
    const lon = resultat.representasjonspunkt?.['øst'];

    if (lat == null || lon == null) {
      throw new Error(`No coordinates found for location: ${name}`);
    }

    return { lat, lon, name: resultat.navn || name };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geonorge API error (${error.response.status}): ${error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Determine UTM zone from Geonorge resultat data.
 * Norway is typically in zones 32N and 33N.
 */
function getResultatZone(resultat) {
  // Use the Sone (zone) field if available from Geonorge
  if (resultat.Sone) {
    return resultat.Sone;
  }
  // Fallback: determine zone from easting
  // Norway is typically in zones 32N and 33N
  // However, easting values near 500000 can appear in either zone
  // Use a heuristic: if easting > 500000, it could be zone 32 (east of CM) or zone 33
  // The safest approach is to check if the coordinate makes sense in each zone
  const easting = resultat.Easts || resultat.geom?.coordinates?.[0] || 0;
  const northing = resultat.Norths || resultat.geom?.coordinates?.[1] || 0;
  
  // For Norway (northing > 6000000), try zone 32 first
  // If easting is in the typical range for zone 32 (250000-750000), use zone 32
  // Otherwise use zone 33
  if (easting >= 250000 && easting <= 750000) {
    return 32;
  }
  return 33;
}

/**
 * Convert UTM coordinates to WGS84 lat/lon.
 * Based on EPSG:4258 (ETRS89) which shares the same datum as WGS84.
 */
function utmToWgs84(easting, northing, zone) {
  // UTM parameters for WGS84/ETRS89
  const a = 6378137.0;         // Semi-major axis
  const f = 1.0 / 298.257222101; // Flattening
  const k0 = 0.9996;           // Scale factor

  // False easting and northing
  const FE = 500000;
  const FN = northing > 0 ? 0 : 10000000;

  // Calculate the eccentricity squared
  const e2 = 2 * f - f * f;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const ePrime2 = e2 / (1 - e2);

  // Calculate the meridian radius of curvature
  const mu = northing / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));

  // Calculate the latitude
  const phi1 = mu
    + (3 * e2 / 8 - 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * mu)
    + (15 * e4 / 256 - 45 * e6 / 1024) * Math.sin(4 * mu)
    + (35 * e6 / 3072) * Math.sin(6 * mu);

  // Calculate the radius of curvature of the prime vertical
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const M1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);

  // Calculate the latitude
  const dE = (easting - FE) / (N1 * k0);
  const dE2 = dE * dE;
  const dE3 = dE2 * dE;
  const dE4 = dE3 * dE;
  const dE5 = dE4 * dE;
  const dE6 = dE5 * dE;

  const lat = phi1
    - (M1 * tanPhi1 / (2 * N1 * M1)) * dE2
    + (M1 * tanPhi1 / (24 * N1 * M1 * N1 * N1)) * (5 + 3 * tanPhi1 * tanPhi1 + ePrime2 * cosPhi1 * cosPhi1 - 9 * ePrime2 * cosPhi1 * cosPhi1 * tanPhi1 * tanPhi1) * dE4
    - (M1 * tanPhi1 / (720 * N1 * M1 * N1 * N1 * N1 * N1)) * (61 + 90 * tanPhi1 * tanPhi1 + 45 * tanPhi1 * tanPhi1 * tanPhi1 * tanPhi1) * dE5 * dE;

  // Calculate the longitude
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const lon = lon0
    + (dE - (1 + 2 * tanPhi1 * tanPhi1 + ePrime2 * cosPhi1 * cosPhi1) / 6 * dE3
       + (5 + 28 * tanPhi1 * tanPhi1 + 15 * tanPhi1 * tanPhi1 * tanPhi1 * tanPhi1 + 9 * ePrime2 * cosPhi1 * cosPhi1 + 18 * ePrime2 * cosPhi1 * cosPhi1 * tanPhi1 * tanPhi1) / 120 * dE5)
    * (1 / cosPhi1)
    * (180 / Math.PI);

  // Convert to degrees
  return {
    lat: (lat * 180) / Math.PI,
    lon: lon,
  };
}

/**
 * Fetch weather data from Met.no API.
 * Returns the full weather response data.
 * Throws on failure.
 */
export async function fetchWeather(lat, lon) {
  try {
    const response = await axios.get(MET_NO_URL, {
      params: {
        lat,
        lon,
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Met.no API error (${error.response.status}): ${error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Find the closest timeseries entry to the current time (in UTC).
 * Returns the timeseries object.
 */
export function findClosestTimeseries(weatherData) {
  if (!weatherData.properties || !weatherData.properties.timeseries) {
    throw new Error('Invalid weather data: no timeseries found');
  }

  const timeseries = weatherData.properties.timeseries;
  const now = new Date();
  const nowUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );

  let closest = null;
  let closestDiff = Infinity;

  for (const entry of timeseries) {
    const entryTime = new Date(entry.time).getTime();
    const diff = Math.abs(entryTime - nowUTC);

    if (diff < closestDiff) {
      closestDiff = diff;
      closest = entry;
    }
  }

  if (!closest) {
    throw new Error('No timeseries entries available');
  }

  return closest;
}

/**
 * Derive weather description from cloud_area_fraction.
 * Uses >= for thresholds per spec (boundary at exactly 75 goes to Overcast).
 * Returns 'Unknown' if cloud_area_fraction is not available.
 */
export function getDescription(instantDetails) {
  const cloudCover = instantDetails?.cloud_area_fraction;

  if (cloudCover == null) {
    return 'Unknown';
  }

  if (cloudCover >= 75) {
    return 'Overcast';
  }
  if (cloudCover > 50) {
    return 'Partly cloudy';
  }
  if (cloudCover > 25) {
    return 'Mostly clear';
  }
  return 'Clear';
}

/**
 * Format the weather output.
 */
export function formatWeather(locationName, weather) {
  const lines = [];
  lines.push(`Weather in ${locationName} (Met.no API)`);
  lines.push(`Temperature: ${weather.temperature}°C`);
  lines.push(`Description: ${weather.description}`);
  lines.push(`Humidity: ${weather.humidity}%`);
  lines.push(`Wind Speed: ${weather.windSpeed} m/s`);
  lines.push(`Pressure: ${weather.pressure} hPa`);
  lines.push(`UV Index: ${weather.uvIndex}`);
  return lines.join('\n');
}
