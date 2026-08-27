// Single place to set the contact Met.no requires. Override with WEATHER_USER_AGENT.
export const USER_AGENT =
  process.env.WEATHER_USER_AGENT ||
  'weather-cli/1.0 https://github.com/hans/weather-cli';
