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

    if (!response.data || !response.data.resultat || response.data.resultat.length === 0) {
      throw new Error(`No results found for location: ${name}`);
    }

    const resultat = response.data.resultat[0];

    // Geonorge returns coordinates in utkoordsys 4258 (UTM Norway, ETRS89)
    // We need to convert from UTM to lat/lon
    const easting = resultat.Easts ? resultat.Easts : resultat.geom?.coordinates?.[0];
    const northing = resultat.Norths ? resultat.Norths : resultat.geom?.coordinates?.[1];

    if (easting == null || northing == null) {
      throw new Error(`No coordinates found for location: ${name}`);
    }

    // Convert UTM (zone 32/33 for Norway, EPSG:4258 style) to lat/lon
    // Geonorge utkoordsys=4258 returns ETRS89 in UTM coordinates
    const { lat, lon } = utmToWgs84(easting, northing, getResultatZone(resultat));

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
  // Use the longitude-like value to determine zone
  // Eastings in zone 32N are ~250000-500000, zone 33N are ~500000-750000
  const easting = resultat.Easts || resultat.geom?.coordinates?.[0] || 0;
  if (easting >= 500000) {
    return 33;
  }
  return 32;
}

/**
 * Convert UTM coordinates to WGS84 lat/lon.
 * Based on EPSG:4258 (ETRS89) which shares the same datum as WGS84.
 */
function utmToWgs84(easting, northing, zone) {
  // UTM parameters for WGS84/ETRS89
  const a = 6378137.0;         // Semi-major axis
  const f = 1.0 / 298.257222101; // Flattening
  const b = a * (1 - f);       // Semi-minor axis
  const k0 = 0.9996;           // Scale factor

  // Central meridian for the zone
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const lon0Rad = (lon0 * Math.PI) / 180;

  // False easting and northing
  const FE = 500000;
  const FN = northing > 0 ? 0 : 10000000;

  // Calculate the eccentricity squared
  const e2 = 2 * f - f * f;
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  // Calculate the meridian radius of curvature
  const mu = northing / (a * k0 * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));

  // Calculate the latitude
  const phi1 = mu
    + (3 * e2 / 8 - 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * mu)
    + (15 * e4 / 256 - 45 * e6 / 1024) * Math.sin(4 * mu)
    + (35 * e6 / 3072) * Math.sin(6 * mu);

  // Calculate the radius of curvature of the prime vertical
  const rho2 = e2 * Math.cos(phi1) * Math.cos(phi1);
  const nu2 = a * k0 / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const rho = a * k0 * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);

  // Calculate the latitude
  const tanPhi1 = Math.tan(phi1);
  const secPhi1 = 1 / Math.cos(phi1);
  const dE = (easting - FE) / (nu2 * k0);
  const dE2 = dE * dE;
  const dE3 = dE2 * dE;
  const dE4 = dE3 * dE;
  const dE5 = dE4 * dE;
  const dE6 = dE5 * dE;
  const dE7 = dE6 * dE;

  const lat =
    phi1
    - (tanPhi1 / (2 * rho * nu2)) * dE2
    + (tanPhi1 / (24 * rho * nu2 * nu2 * nu2)) * (5 * dE4 + (3 * tanPhi1 * tanPhi1 + rho2) * dE2)
    - (tanPhi1 / (720 * rho * nu2 * nu2 * nu2 * nu2 * nu2)) * (61 * dE6 + (90 * tanPhi1 * tanPhi1 + 45 * rho2) * dE4 + (15 * tanPhi1 * tanPhi1 - 3 * rho2 + 9 * rho2 * rho2) * dE2);

  // Calculate the longitude
  const lon =
    lon0
    + (dE * secPhi1 / nu2)
    - (dE3 * secPhi1 / (6 * nu2 * nu2 * nu2)) * (nu2 / rho2 + 2 * tanPhi1 * tanPhi1)
    + (dE5 * secPhi1 / (120 * nu2 * nu2 * nu2 * nu2 * nu2)) * (5 * (nu2 / rho2) + 28 * tanPhi1 * tanPhi1 + 24 * tanPhi1 * tanPhi1 * tanPhi1 * tanPhi1);

  // Convert to degrees
  return {
    lat: (lat * 180) / Math.PI,
    lon: (lon * 180) / Math.PI,
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
