const { geocode } = require('./geocode');
const axios = require('axios');

jest.mock('axios');

describe('geocode', () => {
  test('returns coordinates and name on success', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: { geometry: { coordinates: [10.73, 59.91] } },
          stedsnavn: [{ skrivemåte: 'Oslo' }]
        }]
      }
    };
    axios.get.mockResolvedValue(mockResponse);

    const result = await geocode('Oslo');
    expect(result).toEqual({ lat: 59.91, lon: 10.73, name: 'Oslo' });
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('sok=Oslo'),
      expect.any(Object)
    );
  });

  test('throws error when no results found', async () => {
    const mockResponse = { data: { navn: [] } };
    axios.get.mockResolvedValue(mockResponse);

    await expect(geocode('UnknownPlace')).rejects.toThrow('Location not found');
  });

  test('throws error on API failure', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));

    await expect(geocode('Oslo')).rejects.toThrow('Network Error');
  });
});
