import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function geocode(name) {
  const params = {
    sok: name,
    fuzzy: true,
    treffPerSide: 1,
    utkoordsys: 4258,
  };

  try {
    const response = await axios.get(GEONORGE_URL, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    const navn = response.data.navn;

    if (!navn || navn.length === 0) {
      throw new Error(`No location found for: ${name}`);
    }

    const firstResult = navn[0];
    const coords = firstResult.geojson.geometry.coordinates;
    const lon = coords[0];
    const lat = coords[1];

    const hovednavn = firstResult.stedsnavn.find(
      s => s.språk === 'Norsk' && s.navnestatus === 'hovednavn'
    );

    const displayName = hovednavn ? hovednavn.skrivemåte : firstResult.stedsnavn[0]?.skrivemåte || name;

    return { lat, lon, displayName };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geonorge API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Geonorge geocoding failed: ${error.message}`);
  }
}
