# Weather CLI

A command-line weather application that fetches and displays current weather conditions using the [Met.no API](https://api.met.no/weatherapi/locationforecast/2.0/complete).

## Features

- Fetch weather data from Met.no API (no API key required)
- Support for location by name (e.g., `Oslo`)
- Support for coordinates (e.g., `59.91 10.75`)
- Displays temperature, humidity, wind speed, pressure, UV index, and weather description
- Automatic geocoding via Geonorge API
- Formatted output with units and descriptions

## Installation

```bash
npm install
```

## Usage

### By Location Name

```bash
weather Oslo
```

### By Coordinates

```bash
weather 59.91 10.75
```

### Default (Bergen, Norway)

```bash
weather
```

## Example Output

```
Weather in Oslo (Met.no API)
Temperature: 17.6°C
Description: Clear
Humidity: 68.9%
Wind Speed: 2.3 m/s
Pressure: 1010.2 hPa
UV Index: 3.3
```

## Project Structure

```
weather-cli/
├── weather-cli.js  # Main CLI entry point
├── weather.js      # Weather API client and data parser
├── geocode.js      # Geocoding service for location lookup
├── parser.js       # Command-line argument parser
├── output.js       # Output formatting
└── test/
    ├── weather.test.js
    ├── geocode.test.js
    ├── parser.test.js
    ├── output.test.js
    └── integration.test.js
```

## Development

```bash
npm install
npm test
```

## Testing

```bash
npm test          # Run all tests
npm run test:watch  # Run tests in watch mode
```

## API Endpoints

- **Met.no Weather API**: `https://api.met.no/weatherapi/locationforecast/2.0/complete`
- **Geonorge Geocoding API**: `https://ws.geonorge.no/stedsnavn/v1/sted`

## License

ISC
