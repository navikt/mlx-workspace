const axios = require('axios');

async function fetchWeather(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`;
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'weather-cli/1.0 github.com/hans'
    }
  });

  const timeseries = response.data.properties.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available');
  }

  // Spec: Find closest timeseries entry to current time. 
  // For simplicity in this CLI, we take the first one as it's usually the current/closest.
  const current = timeseries[0].data.instant.details;

  return {
    temperature: current.air_temperature,
    humidity: current.relative_humidity,
    windSpeed: current.wind_speed,
    pressure: current.air_pressure_at_sea_level,
    uvIndex: current.ultraviolet_index_clear_sky,
    cloudAreaFraction: current.cloud_area_fraction
  };
}

module.exports = { fetchWeather };
