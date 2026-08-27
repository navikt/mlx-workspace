function formatWeather(locationName, data) {
  const cloudFraction = data.cloudAreaFraction;
  let description = 'Clear';
  if (cloudFraction > 75) description = 'Overcast';
  else if (cloudFraction > 50) description = 'Partly cloudy';
  else if (cloudFraction > 25) description = 'Mostly clear';

  return [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${data.temperature}°C`,
    `Description: ${description}`,
    `Humidity: ${data.humidity}%`,
    `Wind Speed: ${data.windSpeed} m/s`,
    `Pressure: ${data.pressure} hPa`,
    `UV Index: ${data.uvIndex}`
  ].join('\n');
}

module.exports = { formatWeather };
