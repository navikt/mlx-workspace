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

### Required headers

| Header | APIs | Value |
|--------|------|-------|
| `User-Agent` | Met.no (**required by ToS**), Geonorge (recommended) | `<appname>/<version> <contact>` e.g. `weather-cli/1.0 github.com/yourname` |
| `Accept` | Geonorge (recommended) | `application/json` |

> ⚠️ Met.no requires a User-Agent that identifies the app with a real contact. Missing, browser-faked,
> or placeholder contacts (`example.com`) are rejected with **403**. Throttling is **429**.

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

---

## Scoring: the trap checklist

**Pre-registered 1 September 2026, before the next round of runs.** Written down because the
existing scores — 8.5/10 and 6.8/10 — live as prose in `MODELS.md` ("six traps avoided, one hit")
and cannot be reproduced. A score that only one reviewer can arrive at is an opinion with a
decimal point.

Each trap is a yes/no against the produced code. The score is the count of traps avoided out of
the total, and nothing else. No impression, no partial credit, no rounding toward the model you
expected to win.

| # | Trap | Avoided when |
|---|---|---|
| 1 | **UTC drift** | The forecast hour is selected in UTC. Using the host's local time silently returns the wrong hour for anyone not on UTC. |
| 2 | **Boundary at exactly 75** | Cloud cover of exactly 75 lands on the documented side of the threshold. Off-by-one here is invisible until it is wrong. |
| 3 | **URL injection** | The location string is encoded before it goes into the request URL, not concatenated. |
| 4 | **Missing UV index** | A payload without `ultraviolet_index_clear_sky` does not print `UV Index: undefined` and exit 0. Absent data must not read as data. |
| 5 | **Missing cloud fraction** | A payload without cloud cover does not print "Clear". A confident wrong answer is worse than an error. |
| 6 | **A test that cannot fail** | No assertion is wrapped in a `try`/`catch` that swallows it. Node's `assert` throws, so a catch meant to tolerate a network outage silently tolerates the assertion too. One submission reported "20/20 passing" where one could never fail. |
| 7 | **The `example.com` placeholder** | The User-Agent does not contain `example.com`. The spec names it as rejected and gives a working example on the line above; three of four models put it there anyway. |
| 8 | **403 read as throttling** | A hard 403 is not diagnosed as rate limiting. Met.no's block has no `Retry-After` and no `RateLimit-*` headers; real throttling returns 429. Backoff against a wall that never opens costs about five minutes per occurrence. |

### Rules for the reviewer

**Score blind.** Strip the model identity from the workspace before reading the code. This
matters more now than it did: two instruments already agree that Qwen3.8 produces better output,
so a reviewer who knows which directory is which will find what they expect. Rename to `a/`,
`b/`, `c/` and keep the mapping in a file you do not open until the scores are written down.

**n>=3 per model.** Every conclusion this repository has reversed reversed on a second sample,
never on better reasoning. One generation run is an anecdote with a decimal point.

**Traps 1-5 are read from the code; 6 from the tests; 7-8 from the transcript.** A model that
never reaches the API cannot hit trap 8, and that is not the same as avoiding it — record it as
`n/a` and reduce the denominator rather than awarding a point for work not done.

**Add a trap only between rounds, never during one.** A trap added after seeing the output is a
description of that output.
