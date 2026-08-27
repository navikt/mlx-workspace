const axios = require('axios');

async function geocode(name) {
  const url = `https://ws.geonorge.no/stedsnavn/v1/sted?sok=${encodeURIComponent(name)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;
  
  const response = await axios.get(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'weather-cli/1.0 github.com/hans'
    }
  });

  const results = response.data.navn;
  if (!results || results.length === 0) {
    throw new Error('Location not found');
  }

  const { coordinates } = results[0].geojson.geometry;
  // Geonorge returns [lon, lat], we need { lat, lon }
  return {
    lat: coordinates[1],
    lon: coordinates[0],
    name: results[0].stedsnavn[0].skrivemåte || name
  };
}

module.exports = { geocode };
