const { parseArgs } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather, getDescription } = require('./weather');
const { formatOutput } = require('./output');
const { expect } = require('chai');
const nock = require('nock');

describe('integration', () => {
  beforeEach(() => {
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, {
        navn: [
          {
            geojson: {
              geometry: {
                type: 'Point',
                coordinates: [10.73353, 59.91187],
              },
            },
          },
        ],
      });

    const now = new Date();
    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, {
        properties: {
          timeseries: [
            {
              startTime: now.toISOString(),
              data: {
                instant: {
                  details: {
                    temperature: 15.5,
                    relative_humidity: 65,
                    wind_speed: 4.2,
                    air_pressure_at_sea_level: 1013.2,
                    ultraviolet_index_total: 3.0,
                    cloud_area_fraction: 20,
                  },
                },
              },
            },
          ],
        },
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should complete full flow: location -> geocode -> weather -> output', async () => {
    const parsed = parseArgs(['Oslo']);
    expect(parsed.type).to.equal('location');

    const coords = await geocode(parsed.name);
    expect(coords).to.have.property('lat');
    expect(coords).to.have.property('lon');

    const weather = await fetchWeather(coords.lat, coords.lon);
    expect(weather).to.have.property('temperature');
    expect(weather).to.have.property('humidity');
    expect(weather).to.have.property('windSpeed');
    expect(weather).to.have.property('pressure');
    expect(weather).to.have.property('uvIndex');

    const description = getDescription(weather.cloudAreaFraction);
    expect(description).to.be.a('string');

    const output = formatOutput({ ...weather, description }, parsed.name);
    expect(output).to.be.a('string');
    expect(output).to.include('Oslo');
    expect(output).to.include('15.5');
  });

  it('should complete full flow: coordinates -> weather -> output', async () => {
    const parsed = parseArgs(['59.91 10.75']);
    expect(parsed.type).to.equal('coordinates');

    const weather = await fetchWeather(parsed.lat, parsed.lon);
    expect(weather).to.have.property('temperature');

    const description = getDescription(weather.cloudAreaFraction);
    const output = formatOutput({ ...weather, description }, `${parsed.lat} ${parsed.lon}`);
    expect(output).to.be.a('string');
  });

  it('should handle API errors gracefully', async () => {
    nock.cleanAll();
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .reply(500);

    try {
      await geocode('Oslo');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).to.be.a('string');
    }
  });
});
