# Weather CLI Specification

## Overview

A command-line weather application that fetches and displays current weather conditions for any location in Norway using the Met.no API.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    weather-cli.js                       │
│              (Main CLI entry point)                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   parser    │  │    geocode  │  │   weather   │     │
│  │             │  │            │  │             │     │
│  │             │  │            │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │              │              │                 │
│         ▼              ▼              ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  format     │  │   axios     │  │   axios     │     │
│  │  output     │  │   (Geonorge)│  │  (Met.no)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Modules

### 1. parser.js
**Purpose:** Parse command-line arguments

**Functions:**
- `parseArgs(args[])` - Parse arguments, extract location parameter
- `parseCoordinates(input)` - Parse "lat lon" format, validate ranges (0-90, 0-180)
- `parseLocationName(input)` - Return default Bergen coordinates with custom name

**Return Types:**
```typescript
{ location?: string }
{ lat: number, lon: number } | null
{ lat: number, lon: number, name: string }
```

### 2. geocode.js
**Purpose:** Convert location names to coordinates via Geonorge API

**API Endpoint:** `https://ws.geonorge.no/stedsnavn/v1/sted`

**Function:**
- `geocode(location: string): Promise<{lat, lon, name} | null>`

**Parameters:**
- `location` - Location name to geocode

**Returns:**
```typescript
{
  lat: number,  // Latitude (0-90)
  lon: number,  // Longitude (0-180)
  name: string  // Found location name
} | null
```

**Error Handling:** Returns `null` on any error or no results found

### 3. weather.js
**Purpose:** Fetch and parse weather data from Met.no API

**API Endpoint:** `https://api.met.no/weatherapi/locationforecast/2.0/complete`

**Functions:**
- `fetchWeather(lat: number, lon: number): Promise<WeatherData>`
- `parseWeatherData(rawData): WeatherData`
- `getWeatherDescription(cloudFraction: number): string`

**Weather Data Structure:**
```typescript
interface WeatherData {
  temperature: number | undefined,  // °C
  humidity: number | undefined,      // %
  windSpeed: number | undefined,     // m/s
  pressure: number | undefined,      // hPa
  uvIndex: number | undefined,
  description: string               // 'Clear', 'Mostly clear', 'Partly cloudy', 'Overcast'
}
```

**Weather Descriptions:**
- `cloudFraction <= 25%` → "Clear"
- `cloudFraction <= 50%` → "Mostly clear"
- `cloudFraction <= 75%` → "Partly cloudy"
- `cloudFraction > 75%` → "Overcast"

### 4. output.js
**Purpose:** Format weather data for display

**Function:**
- `formatOutput(weather: WeatherData, locationName: string): string`

**Output Format:**
```
Weather in {locationName} (Met.no API)
Temperature: {temperature}°C
Description: {description}
Humidity: {humidity}%
Wind Speed: {windSpeed} m/s
Pressure: {pressure} hPa
UV Index: {uvIndex}
```

## CLI Usage

### Commands

```bash
# Default: Bergen, Norway
weather

# By location name
weather Oslo
weather "Oslo kommune"

# By coordinates
weather 59.91 10.75
```

### Input Formats

**Location Name:** Any place name in Norway (will be geocoded)

**Coordinates:** Two decimal numbers (latitude longitude)
- Latitude: 0-90 (positive)
- Longitude: 0-180 (positive)

## API Dependencies

| Service | Endpoint | Purpose |
|---------|---------|---------|
| Geonorge | `https://ws.geonorge.no/stedsnavn/v1/sted` | Geocoding (location → coordinates) |
| Met.no | `https://api.met.no/weatherapi/locationforecast/2.0/complete` | Weather data |

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `parser.test.js` | 12 tests | Argument parsing, coordinate validation |
| `geocode.test.js` | 8 tests | Geocoding, error handling, edge cases |
| `weather.test.js` | 13 tests | Weather fetching, parsing, descriptions |
| `output.test.js` | 9 tests | Output formatting, units |
| `integration.test.js` | 5 tests | End-to-end flow |

**Total:** 47 tests

## Error Handling

1. **Invalid coordinates:** Returns error message, exits with code 1
2. **Geocoding failure:** Returns error message, exits with code 1
3. **API errors:** Caught and handled gracefully

## Environment

- **Node.js:** 18+
- **TypeScript:** No (plain JavaScript with ES modules)
- **Dependencies:** axios

## Running

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run CLI
node weather-cli.js [location]
```

## Future Enhancements

- [ ] Add unit tests for all edge cases
- [ ] Add caching for repeated location queries
- [ ] Support for historical weather data
- [ ] Add more weather metrics (precipitation, visibility)
- [ ] Add location history
- [ ] Support for multiple locations

## License

ISC

## Built With

- **Qwen3.5-9B-MLX-4bit** - AI model for code generation and assistance
- **OpenCode** - AI coding assistant for project management and development