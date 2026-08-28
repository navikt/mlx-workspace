const { fetchWeather, getDescription } = require('./weather');
const { expect } = require('chai');
const nock = require('nock');

describe('weather', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('fetchWeather', () => {
    it('should return weather data with all required fields', async () => {
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

      const result = await fetchWeather(59.91, 10.75);
      expect(result).to.have.property('temperature', 15.5);
      expect(result).to.have.property('humidity', 65);
      expect(result).to.have.property('windSpeed', 4.2);
      expect(result).to.have.property('pressure', 1013.2);
      expect(result).to.have.property('uvIndex', 3.0);
      expect(result).to.have.property('cloudAreaFraction', 20);
    });

    it('should throw when no timeseries data', async () => {
      nock('https://api.met.no')
        .get('/weatherapi/locationforecast/2.0/complete')
        .reply(200, { properties: { timeseries: [] } });

      await expect(fetchWeather(59.91, 10.75)).to.be.rejectedWith(/No weather data/);
    });

    it('should throw when no instant data', async () => {
      nock('https://api.met.no')
        .get('/weatherapi/locationforecast/2.0/complete')
        .reply(200, {
          properties: {
            timeseries: [
              { data: {} },
            ],
          },
        });

      await expect(fetchWeather(59.91, 10.75)).to.be.rejectedWith(/No instant data/);
    });

    it('should throw on API error', async () => {
      nock('https://api.met.no')
        .get('/weatherapi/locationforecast/2.0/complete')
        .reply(403);

      await expect(fetchWeather(59.91, 10.75)).to.be.rejected();
    });
  });

  describe('getDescription', () => {
    it('should return "Clear" for 0% cloud coverage', () => {
      expect(getDescription(0)).to.equal('Clear');
    });

    it('should return "Mostly clear" for 20% cloud coverage', () => {
      expect(getDescription(20)).to.equal('Mostly clear');
    });

    it('should return "Mostly clear" for 30% cloud coverage', () => {
      expect(getDescription(30)).to.equal('Mostly clear');
    });

    it('should return "Partly cloudy" for 60% cloud coverage', () => {
      expect(getDescription(60)).to.equal('Partly cloudy');
    });

    it('should return "Overcast" for 80% cloud coverage', () => {
      expect(getDescription(80)).to.equal('Overcast');
    });

    it('should return "Clear" when cloudAreaFraction is undefined', () => {
      expect(getDescription(undefined)).to.equal('Clear');
    });
  });
});
