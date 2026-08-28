const { parseArgs } = require('./parser');
const { expect } = require('chai');

describe('parser', () => {
  describe('parseArgs', () => {
    it('should return { type: "none" } when no args provided', () => {
      const result = parseArgs([]);
      expect(result).to.deep.equal({ type: 'none' });
    });

    it('should return { type: "location" } for a location name', () => {
      const result = parseArgs(['Oslo']);
      expect(result).to.deep.equal({ type: 'location', name: 'Oslo' });
    });

    it('should return { type: "location" } for a location name with spaces', () => {
      const result = parseArgs(['Bergenhus']);
      expect(result).to.deep.equal({ type: 'location', name: 'Bergenhus' });
    });

    it('should parse valid coordinates "lat lon"', () => {
      const result = parseArgs(['59.91 10.75']);
      expect(result).to.deep.equal({
        type: 'coordinates',
        lat: 59.91,
        lon: 10.75,
      });
    });

    it('should parse valid integer coordinates', () => {
      const result = parseArgs(['60 11']);
      expect(result).to.deep.equal({
        type: 'coordinates',
        lat: 60,
        lon: 11,
      });
    });

    it('should parse negative coordinates', () => {
      const result = parseArgs(['-34.60 -58.38']);
      expect(result).to.deep.equal({
        type: 'coordinates',
        lat: -34.60,
        lon: -58.38,
      });
    });

    it('should throw on invalid latitude (> 90)', () => {
      expect(() => parseArgs(['91 10'])).to.throw(/Invalid latitude/);
    });

    it('should throw on invalid latitude (< -90)', () => {
      expect(() => parseArgs(['-91 10'])).to.throw(/Invalid latitude/);
    });

    it('should throw on invalid longitude (> 180)', () => {
      expect(() => parseArgs(['50 181'])).to.throw(/Invalid longitude/);
    });

    it('should throw on invalid longitude (< -180)', () => {
      expect(() => parseArgs(['50 -181'])).to.throw(/Invalid longitude/);
    });

    it('should throw on non-coordinate string that looks partial', () => {
      expect(() => parseArgs(['59.91'])).to.throw();
    });

    it('should throw on non-numeric coordinate string', () => {
      expect(() => parseArgs(['abc def'])).to.throw();
    });
  });
});
