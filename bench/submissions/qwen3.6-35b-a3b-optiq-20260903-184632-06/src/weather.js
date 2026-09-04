import axios from 'axios';

const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function fetchWeather(lat, lon) {
  const baseUrl = process.env.MET_NO_BASE || 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
  const url = `${baseUrl}?lat=${lat}&lon=${lon}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  const timeseries = response.data.properties.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available');
  }

  // Find the timeseries entry closest to current time (UTC)
  const now = new Date();
  let closest = timeseries[0];
  let closestDiff = Math.abs(new Date(timeseries[0].time).getTime() - now.getTime());

  for (let i = 1; i < timeseries.length; i++) {
    const diff = Math.abs(new Date(timeseries[i].time).getTime() - now.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = timeseries[i];
    }
  }

  const details = closest.data.instant.details;

  const temperature = details.air_temperature;
  const humidity = details.relative_humidity;
  const windSpeed = details.wind_speed;
  const pressure = details.air_pressure_at_sea_level;
  const uvIndex = details.ultraviolet_index_clear_sky !== undefined
    ? details.ultraviolet_index_clear_sky
    : null;
  const cloudArea = details.cloud_area_fraction !== undefined
    ? details.cloud_area_fraction
    : null;

  return {
    temperature,
    humidity,
    windSpeed,
    pressure,
    uvIndex,
    cloudArea,
  };
}
