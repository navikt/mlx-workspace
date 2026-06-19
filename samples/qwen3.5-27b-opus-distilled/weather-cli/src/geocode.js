import axios from 'axios';

/**
 * Geocode a place name using Geonorge API
 * @param {string} placeName - The place name to geocode
 * @returns {{success: boolean, lat?: number, lon?: number, name?: string, error?: string}}
 */
export async function geocode(placeName) {
  try {
    const encodedName = encodeURIComponent(placeName);
    const url = `https://ws.geonorge.no/stedsnavn/v1/sted?sok=${encodedName}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;

    // Check if we got a valid GeoJSON response with features
    if (!data || !data.features || data.features.length === 0) {
      return {
        success: false,
        error: `No location found for "${placeName}"`
      };
    }

    const feature = data.features[0];
    const coordinates = feature.geometry.coordinates;

    // Geonorge returns [lon, lat], we need to swap to [lat, lon]
    const lon = coordinates[0];
    const lat = coordinates[1];

    // Get the place name from properties
    const name = feature.properties?.navn || placeName;

    return {
      success: true,
      lat,
      lon,
      name
    };
  } catch (error) {
    return {
      success: false,
      error: `Geocoding API error: ${error.message}`
    };
  }
}
