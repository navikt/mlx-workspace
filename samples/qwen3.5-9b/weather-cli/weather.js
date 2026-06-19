// Weather module for fetching and parsing weather data
const axios = require('axios');

const WEATHER_API_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const DEFAULT_USER_AGENT = 'weather-cli/1.0 github.com/navikt/mlx-workspace';

async function fetchWeather(lat, lon) {
  const response = await axios.get(`${WEATHER_API_URL}?lat=${lat}&lon=${lon}`, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT
    }
  });
  
  return parseWeatherData(response.data);
}

function parseWeatherData(rawData) {
  const timeseries = rawData.properties.timeseries;
  const currentTime = new Date().toISOString();
  let currentIdx = -1;
  let minDiff = Infinity;
  
  // Find the closest time in the timeseries
  for (let i = 0; i < timeseries.length; i++) {
    const tsTime = new Date(timeseries[i].time);
    const timeDiff = Math.abs(tsTime.getTime() - new Date(currentTime).getTime());
    
    if (timeDiff < minDiff) {
      minDiff = timeDiff;
      currentIdx = i;
    } else if (timeDiff === minDiff) {
      // If times are equal, prefer the later one
      const tsTime2 = new Date(timeseries[i + 1]?.time);
      if (tsTime2 && tsTime2.getTime() > tsTime.getTime()) {
        currentIdx = i + 1;
        minDiff = timeDiff;
      }
    }
  }
  
  const current = timeseries[currentIdx]?.data?.instant?.details;
  const temperature = current?.air_temperature;
  const humidity = current?.relative_humidity;
  const windSpeed = current?.wind_speed;
  const pressure = current?.air_pressure_at_sea_level;
  const cloudFraction = current?.cloud_area_fraction;
  const uvIndex = current?.ultraviolet_index_clear_sky;
  
  const description = cloudFraction !== undefined ? getWeatherDescription(cloudFraction) : 'Clear';
  
  return {
    temperature,
    humidity,
    windSpeed,
    pressure,
    uvIndex,
    description
  };
}

function getWeatherDescription(cloudFraction) {
  if (cloudFraction > 75) {
    return 'Overcast';
  }
  if (cloudFraction > 50) {
    return 'Partly cloudy';
  }
  if (cloudFraction > 25) {
    return 'Mostly clear';
  }
  return 'Clear';
}

module.exports = { fetchWeather, parseWeatherData, getWeatherDescription };
