import { expect } from 'chai';
import { parseArgs } from '../src/parser.js';

describe('parseArgs', () => {
  describe('coordinates', () => {
    it('should parse valid Oslo coordinates', () => {
      const result = parseArgs(['59.91', '10.75']);
      expect(result.type).to.equal('coordinates');
      expect(result.lat).to.equal(59.91);
      expect(result.lon).to.equal(10.75);
    });

    it('should parse coordinates in single string', () => {
      const result = parseArgs(['59.91 10.75']);
      expect(result.type).to.equal('coordinates');
      expect(result.lat).to.equal(59.91);
      expect(result.lon).to.equal(10.75);
    });

    it('should parse integer coordinates', () => {
      const result = parseArgs(['60', '10']);
      expect(result.type).to.equal('coordinates');
      expect(result.lat).to.equal(60);
      expect(result.lon).to.equal(10);
    });

    it('should parse negative coordinates', () => {
      const result = parseArgs(['-40.5', '-70.25']);
      expect(result.type).to.equal('coordinates');
      expect(result.lat).to.equal(-40.5);
      expect(result.lon).to.equal(-70.25);
    });

    it('should reject latitude > 90', () => {
      const result = parseArgs(['91', '10']);
      expect(result.type).to.equal('error');
      expect(result.error).to.include('latitude');
    });

    it('should reject latitude < -90', () => {
      const result = parseArgs(['-91', '10']);
      expect(result.type).to.equal('error');
      expect(result.error).to.include('latitude');
    });

    it('should reject longitude > 180', () => {
      const result = parseArgs(['59', '181']);
      expect(result.type).to.equal('error');
      expect(result.error).to.include('longitude');
    });

    it('should reject longitude < -180', () => {
      const result = parseArgs(['59', '-181']);
      expect(result.type).to.equal('error');
      expect(result.error).to.include('longitude');
    });
  });

  describe('place names', () => {
    it('should parse Oslo as place name', () => {
      const result = parseArgs(['Oslo']);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('Oslo');
    });

    it('should parse Bergen as place name', () => {
      const result = parseArgs(['Bergen']);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('Bergen');
    });

    it('should parse place names with spaces', () => {
      const result = parseArgs(['Stavanger']);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('Stavanger');
    });
  });

  describe('default behavior', () => {
    it('should default to Oslo when no arguments', () => {
      const result = parseArgs([]);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('Oslo');
    });

    it('should default to Oslo when null', () => {
      const result = parseArgs(null);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('Oslo');
    });
  });

  describe('edge cases', () => {
    it('should reject non-coordinate strings', () => {
      const result = parseArgs(['not-a-coordinate']);
      expect(result.type).to.equal('place');
      expect(result.name).to.equal('not-a-coordinate');
    });

    it('should handle whitespace in coordinate string', () => {
      const result = parseArgs(['  59.91  10.75  ']);
      expect(result.type).to.equal('coordinates');
      expect(result.lat).to.equal(59.91);
      expect(result.lon).to.equal(10.75);
    });
  });
});
