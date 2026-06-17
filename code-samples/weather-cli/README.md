# Weather CLI for Bergen, Norway

A simple command-line weather app that displays current weather conditions for Bergen, Norway.

## Setup

1. Get a free API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Set the API key as environment variable:

```bash
export OPENWEATHER_API_KEY=your_api_key_here
```

3. Install the package globally:

```bash
npm install -g .
```

## Usage

```bash
weather
```

## Example Output

```
Weather in Bergen:
Temperature: 15.2°C
Description: clear sky
Humidity: 65%
Wind Speed: 3.2 m/s
```

## Development

To run locally:

```bash
node weather.js
```

To install dependencies:

```bash
npm install
```