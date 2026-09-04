export function deriveDescription(cloudArea) {
  if (cloudArea === null) {
    throw new Error('Cloud area fraction is missing');
  }

  if (cloudArea > 75) {
    return 'Overcast';
  }
  if (cloudArea > 50) {
    return 'Partly cloudy';
  }
  if (cloudArea > 25) {
    return 'mostly clear';
  }
  return 'Clear';
}

export function formatOutput(locationName, weather) {
  const { temperature, humidity, windSpeed, pressure, uvIndex } = weather;
  const description = deriveDescription(weather.cloudArea);

  let output = `Weather in ${locationName} (Met.no API)\n`;
  output += `Temperature: ${temperature}\u00B0C\n`;
  output += `Description: ${description}\n`;
  output += `Humidity: ${humidity}%\n`;
  output += `Wind Speed: ${windSpeed} m/s\n`;
  output += `Pressure: ${pressure} hPa\n`;

  if (uvIndex !== null) {
    output += `UV Index: ${uvIndex}\n`;
  }

  return output;
}
