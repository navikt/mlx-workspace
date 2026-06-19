// Geocoding module for location name to coordinates conversion
import axios from 'axios';

const GEOCODING_API_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const DEFAULT_USER_AGENT = 'weather-cli/1.0 github.com/navikt/mlx-workspace';

async function geocode(location) {
  try {
    const url = `${GEOCODING_API_URL}?sok=${encodeURIComponent(location)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      }
    });

    const data = response.data;
    
    if (data && data.navn && data.navn.length > 0) {
      const result = data.navn[0];
      const name = result.stedsnavn && result.stedsnavn[0] 
        ? result.stedsnavn[0].skrivemåte 
        : result.navn;
      const geojson = result.geojson;
      const coords = geojson && geojson.geometry && geojson.geometry.coordinates;
      
      if (coords && coords.length === 2) {
        // Geonorge returns [lon, lat], we need [lat, lon]
        return {
          lat: coords[1],
          lon: coords[0],
          name: name
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export { geocode };
