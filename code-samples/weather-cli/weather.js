#!/usr/bin/env node

// Simple weather CLI for Bergen, Norway
const axios = require('axios');

// Using a free weather API that doesn't require registration
const API_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Bergen coordinates (latitude: 60.3944, longitude: 5.3227)
const BERGEN_LAT = 60.3944;
const BERGEN_LONG = 5.3227;

// Function to get weather data for Bergen
async function getWeather() {
  try {
    const response = await axios.get(API_URL, {
      params: {
        lat: BERGEN_LAT,
        lon: BERGEN_LONG,
        appid: "03333333333333333333333333333333333", // Placeholder - user needs to set their own key
        units: 'metric' // Celsius
      }
    });

    const weather = response.data;
    const temperature = weather.main.temp;
    const description = weather.weather[0].description;
    const humidity = weather.main.humidity;
    const windSpeed = weather.wind.speed;

    console.log('Weather in Bergen:');
    console.log('Temperature:', `${temperature}°C`);
    console.log('Description:', description);
    console.log('Humidity:', `${humidity}%`);
    console.log('Wind Speed:', `${windSpeed} m/s`);
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    console.log('Please set your OpenWeatherMap API key:');
    console.log('1. Sign up at https://openweathermap.org/api');
    console.log('2. Get your free API key');
    console.log('3. Set it as environment variable:');
    console.log('   export OPENWEATHER_API_KEY=your_api_key_here');
  }
}

// Main function
async function main() {
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log('Weather CLI for Bergen, Norway');
    console.log('This CLI requires an OpenWeatherMap API key');
    console.log('1. Sign up at https://openweathermap.org/api');
    console.log('2. Get your free API key');
    console.log('3. Set it as environment variable:');
    console.log('   export OPENWEATHER_API_KEY=your_api_key_here');
    console.log('4. Run the command again');
    process.exit(1);
  }

  await getWeather();
}

// Run the main function
main();