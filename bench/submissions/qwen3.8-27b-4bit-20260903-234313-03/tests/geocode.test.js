import { describe, it, expect } from "vitest";
import { geocode, buildGeocodeUrl } from "../src/geocode.js";

function fakeHttp(body, { status = 200, fail = null } = {}) {
  return {
    get: async (url, config) => {
      if (fail) throw fail;
      return { status, data: body, config };
    },
  };
}

const OSLO_BODY = {
  metadata: { totaltAntallTreff: 125, treffPerSide: 1, viserFra: 1, viserTil: 1 },
  navn: [
    {
      navn: "Oslo",
      fylker: [{ fylkesnavn: "Oslo", fylkesnummer: "03" }],
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: "Point" } },
      representasjonspunkt: { nord: 59.91187, øst: 10.73353 },
      stedsnavn: [
        { skrive: "Oslo fylke", skrive: "Oslo", skrivemåte: "Oslo fylke", navnestatus: "hovednavn", språk: "Norsk" },
        { skrivemåte: "Oslo", navnestatus: "hovednavn", språk: "Norsk" },
      ],
      navneobjekttype: "Fylke",
      stedstatus: "aktiv",
    },
  ],
};

describe("buildGeocodeUrl", () => {
  it("encodes the name and required params", () => {
    const url = new URL(buildGeocodeUrl("Oslo", "https://ws.geonorge.no/stedsnavn/v1/sted"));
    expect(url.searchParams.get("sok")).toBe("Oslo");
    expect(url.searchParams.get("fuzzy")).toBe("true");
    expect(url.searchParams.get("treffPerSide")).toBe("1");
    expect(url.searchParams.get("utkoordsys")).toBe("4258");
  });

  it("URL-encodes special characters", () => {
    const url = new URL(buildGeocodeUrl("Tromsø", "https://ws.geonorge.no/stedsnavn/v1/sted"));
    expect(decodeURIComponent(url.searchParams.get("sok"))).toBe("Tromsø");
  });
});

describe("geocode", () => {
  it("swaps GeoJSON [lon, lat] to {lat, lon} and picks the display name", async () => {
    const r = await geocode("Oslo", { http: fakeHttp(OSLO_BODY) });
    expect(r).toEqual({ name: "Oslo fylke", lat: 59.91187, lon: 10.73353 });
  });

  it("falls back to the query name when no skrivemåte", async () => {
    const body = {
      ...OSLO_BODY,
      navn: [{ ...OSLO_BODY.navn[0], stedsnavn: [] }],
    };
    const r = await geocode("Oslo", { http: fakeHttp(body) });
    expect(r.name).toBe("Oslo");
  });

  it("throws when totaltAntallTreff is 0", async () => {
    const body = { metadata: { totaltAntallTreff: 0 }, navn: [] };
    await expect(geocode("Paris", { http: fakeHttp(body) })).rejects.toThrow(/no place found for "Paris"/);
  });

  it("throws when navn is empty", async () => {
    const body = { metadata: { totaltAntallTreff: 3 }, navn: [] };
    await expect(geocode("Xyz", { http: fakeHttp(body) })).rejects.toThrow(/no place found/);
  });

  it("throws when the result has no coordinates", async () => {
    const body = { metadata: { totaltAntallTreff: 1 }, navn: [{ stedsnavn: [{ skrivemåte: "Foo" }] }] };
    await expect(geocode("Foo", { http: fakeHttp(body) })).rejects.toThrow(/no coordinates/);
  });

  it("throws with HTTP status on network error", async () => {
    const fail = Object.assign(new Error("Request failed with status code 500"), {
      response: { status: 500 },
    });
    await expect(geocode("Oslo", { http: fakeHttp(null, { fail }) })).rejects.toThrow(/HTTP 500/);
  });

  it("sends the provided User-Agent header", async () => {
    let seen;
    const http = {
      get: async (url, config) => {
        seen = config.headers;
        return { status: 200, data: OSLO_BODY };
      },
    };
    await geocode("Oslo", { http, headers: { "User-Agent": "weather-cli/1.0 contact" } });
    expect(seen["User-Agent"]).toBe("weather-cli/1.0 contact");
    expect(seen.Accept).toBe("application/json");
  });
});
