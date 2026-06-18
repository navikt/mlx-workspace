# Weather CLI Specification

## API Contract

### Input

```
weather [location]
```

**location** (optional):
- String: location name (e.g., "Oslo")
- String: coordinates "lat lon" (e.g., "59.91 10.75")

### Output

```
Weather in {locationName} (Met.no API)
Temperature: {temperature}°C
Description: {description}
Humidity: {humidity}%
Wind Speed: {windSpeed} m/s
Pressure: {pressure} hPa
UV Index: {uvIndex}
```

## Data Flow

1. Parse arguments → extract location
2. If coordinates: parse and validate
3. If location name: geocode to coordinates
4. Fetch weather from Met.no API
5. Parse weather data
6. Format and output

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://ws.geonorge.no/stedsnavn/v1/sted` | GET | Geocoding |
| `https://api.met.no/weatherapi/locationforecast/2.0/complete` | GET | Weather data |

## Error Handling

- Invalid coordinates → exit code 1
- Geocoding failure → exit code 1
- API errors → exit code 1

## Exit Codes

- 0: Success
- 1: Error

## Dependencies

- axios

## Tests

- parser.test.js
- geocode.test.js
- weather.test.js
- output.test.js
- integration.test.js
