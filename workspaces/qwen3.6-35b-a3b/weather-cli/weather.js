import axios from 'axios';

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function fetchWeather(lat, lon) {
  const url = new URL(MET_NO_URL);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);

  const res = await axios.get(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
    },
    timeout: 15000,
  });

  const timeseries = res.data?.properties?.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available');
  }

  // Find the timeseries entry closest to the current time
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

  const instant = closest.data?.instant;
  if (!instant?.details) {
    throw new Error('No instant details in weather data');
  }

  const details = instant.details;

  // Derive description from cloud_area_fraction
  const cloud = details.cloud_area_fraction;
  let description = 'Clear';
  if (cloud > 75) {
    description = 'Overcast';
  } else if (cloud > 50) {
    description = 'Partly cloudy';
  } else if (cloud > 25) {
    description = 'Mostly clear';
  }

  return {
    temperature: details.air_temperature,
    description,
    humidity: details.relative_humidity,
    windSpeed: details.wind_speed,
    pressure: details.air_pressure_at_sea_level,
    uvIndex: details.ultraviolet_index_clear_sky,
  };
}
