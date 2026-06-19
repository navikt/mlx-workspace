# Weather CLI Specification

## API Contract

### Input

```
weather [location]
```

**location** (optional):
- String: Norwegian place name resolved via Geonorge (e.g., "Oslo", "Bergen")
- String: coordinates `"lat lon"` space-separated decimal (e.g., "59.91 10.75")

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
2. If coordinates: parse and validate (`lat lon` order)
3. If location name: geocode via Geonorge → returns GeoJSON `[lon, lat]` → swap to `[lat, lon]`
4. Fetch weather from Met.no API (requires `User-Agent` header)
5. Find closest timeseries entry to current time
6. Extract `instant.details` fields; derive `description` from `cloud_area_fraction`:
   - `> 75%` → Overcast, `> 50%` → Partly cloudy, `> 25%` → Mostly clear, else → Clear
7. Format and output

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://ws.geonorge.no/stedsnavn/v1/sted?sok={name}&fuzzy=true&treffPerSide=1&utkoordsys=4258` | GET | Norwegian geocoding (Norway only) |
| `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat={lat}&lon={lon}` | GET | Weather data |

> Both APIs require a `User-Agent` header.

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
