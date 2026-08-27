// Output module for formatting weather data
function formatOutput(weather, locationName) {
  let output = `Weather in ${locationName || 'Bergen, Norway'} (Met.no API)\n`;
  output += `Temperature: ${formatTemperature(weather.temperature)}°C\n`;
  output += `Description: ${weather.description}\n`;
  output += `Humidity: ${weather.humidity}%\n`;
  output += `Wind Speed: ${weather.windSpeed.toFixed(1)} m/s\n`;
  output += `Pressure: ${weather.pressure.toFixed(1)} hPa\n`;
  output += `UV Index: ${weather.uvIndex}\n`;
  return output;
}

function formatTemperature(temp) {
  if (temp === undefined || temp === null) {
    return temp;
  }
  // Always preserve original decimal places
  return temp.toString();
}

module.exports = { formatOutput };
