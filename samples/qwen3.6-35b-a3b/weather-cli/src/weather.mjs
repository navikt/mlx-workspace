const GEONORGE_BASE = "https://ws.geonorge.no/stedsnavn/v1/sted";
const WEATHER_BASE = "https://api.met.no/weatherapi/locationforecast/2.0/complete";

const UA = "weather-cli/1.0 github.com/navikt";

/**
 * Geocode a Norwegian place name via Geonorge.
 * Returns GeoJSON features with coordinates as [lon, lat] — swaps to [lat, lon].
 * @param {string} name - Place name (e.g., "Oslo")
 * @returns {Promise<{ name: string, lat: number, lon: number }>}
 */
export async function geocode(name) {
  const url = new URL(GEONORGE_BASE);
  url.searchParams.set("sok", name);
  url.searchParams.set("fuzzy", "true");
  url.searchParams.set("treffPerSide", "1");
  url.searchParams.set("utkoordsys", "4326");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": UA, "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding failed: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  // Geonorge API returns { metadata, navn: [{ geojson: { geometry: { coordinates: [lon, lat] } }, stedsnavn: [{ skrivemåte }] }] }
  const navneobjekter = json?.navn;
  if (!navneobjekter || navneobjekter.length === 0) {
    throw new Error(`No results found for "${name}"`);
  }

  const obj = navneobjekter[0];
  const coords = obj?.geojson?.geometry?.coordinates; // [lon, lat]
  if (!coords || coords.length < 2) {
    throw new Error(`No coordinates found for "${name}"`);
  }

  // GeoJSON is [lon, lat] — swap to [lat, lon]
  const lon = coords[0];
  const lat = coords[1];

  // Get the place name from the first stedsnavn entry's skrivemåte
  const navnestaver = obj?.stedsnavn || [];
  let placeName = name;
  for (const sn of navnestaver) {
    if (sn.skrivemåte) {
      placeName = sn.skrivemåte;
      break;
    }
  }

  return {
    name: placeName,
    lat,
    lon,
  };
}

/**
 * Fetch weather data from Met.no given coordinates.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<WeatherData>}
 */
export async function fetchWeather(lat, lon) {
  const url = new URL(WEATHER_BASE);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
  });

  if (!response.ok) {
    throw new Error(
      `Weather API failed: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  return parseWeatherData(json);
}

/**
 * Extract weather from Met.no timeseries response.
 * Finds the timeseries entry closest to the current time,
 * then extracts `instant.details` fields and derives description from cloud coverage.
 * @param {object} data - Parsed JSON response
 * @returns {object} Structured weather data
 */
function parseWeatherData(data) {
  const timeseries = data?.properties?.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error("No timeseries data found in API response");
  }

  // Find the timeseries entry closest to the current time
  const now = Date.now();
  let closest = timeseries[0];
  let closestDiff = Math.abs(new Date(timeseries[0].time).getTime() - now);

  for (let i = 1; i < timeseries.length; i++) {
    const diff = Math.abs(new Date(timeseries[i].time).getTime() - now);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = timeseries[i];
    }
  }

  const instant = closest?.data?.instant;
  if (!instant || !instant.details) {
    throw new Error("No instant details found in timeseries data");
  }

  const details = instant.details;

  // Extract temperature (°C)
  const temperature = details.air_temperature ?? null;

  // Derive description from cloud coverage
  const cloudArea = details.cloud_area_fraction;
  const description = describeClouds(cloudArea);

  // Extract remaining fields
  const humidity = details.relative_humidity ?? null;
  const windSpeed = details.wind_speed ?? null;
  const pressure = details.air_pressure_at_sea_level ?? null;
  const uvIndex = details.uv_index_clear_sky ?? null;

  return { temperature, description, humidity, windSpeed, pressure, uvIndex };
}

/**
 * Derive a readable description from cloud coverage percentage.
 * @param {number|null} cloudAreaFraction - Cloud coverage 0–100
 * @returns {string} Description string
 */
function describeClouds(cloudAreaFraction) {
  if (cloudAreaFraction === null || cloudAreaFraction === undefined) {
    return "N/A";
  }
  if (cloudAreaFraction > 75) return "Overcast";
  if (cloudAreaFraction > 50) return "Partly cloudy";
  if (cloudAreaFraction > 25) return "Mostly clear";
  return "Clear";
}
