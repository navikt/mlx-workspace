import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

export async function geocode(locationName, userAgent) {
  const encodedName = encodeURIComponent(locationName);
  const url = `${GEONORGE_URL}?sok=${encodedName}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      },
    });

    if (response.data.navn && response.data.navn.length > 0) {
      return response.data.navn[0];
    }

    console.error(`Error: Location "${locationName}" not found`);
    process.exit(1);
  } catch (error) {
    if (error.response) {
      console.error(`Error: Geocoding API returned ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      console.error('Error: Unable to reach Geonorge API');
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}
