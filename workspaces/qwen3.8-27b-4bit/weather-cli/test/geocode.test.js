"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { geocode, GeocodeError, GEONORGE_URL } = require("../src/geocode");

function mockHttp(payload, { status = 200, throwErr } = {}) {
  return {
    async get(url, cfg) {
      if (throwErr) throw throwErr;
      if (status >= 400) {
        const e = new Error("HTTP " + status);
        e.response = { status, data: payload };
        throw e;
      }
      return { status, data: payload, config: cfg, url };
    },
  };
}

const osloPayload = {
  metadata: { totaltAntallTreff: 1 },
  navn: [
    {
      navneobjekttype: "Fylke",
      representasjonspunkt: { nord: 59.91187, øst: 10.73353 },
      stedsnavn: [{ skrivemåte: "Oslo", navnestatus: "hovednavn" }],
    },
  ],
};

test("maps representasjonspunkt nord/øst to lat/lon", async () => {
  const r = await geocode("Oslo", { http: mockHttp(osloPayload) });
  assert.equal(r.lat, 59.91187);
  assert.equal(r.lon, 10.73353);
  assert.equal(r.name, "Oslo");
});

test("URL-encodes the search term (no raw injection)", async () => {
  let seenUrl = "";
  const http = {
    async get(url) {
      seenUrl = url;
      return { status: 200, data: osloPayload };
    },
  };
  await geocode("Oslo & Co", { http });
  assert.ok(seenUrl.startsWith(GEONORGE_URL + "?"));
  // URLSearchParams percent-encodes the ampersand and uses '+' for spaces;
  // the raw " & " must never appear unencoded in the URL.
  assert.ok(seenUrl.includes("sok=Oslo+%26+Co"));
  assert.ok(!seenUrl.includes("sok=Oslo & Co"));
});

test("throws GeocodeError when navn is empty", async () => {
  await assert.rejects(
    geocode("Nowhere", { http: mockHttp({ navn: [] }) }),
    GeocodeError
  );
});

test("throws GeocodeError on HTTP failure", async () => {
  await assert.rejects(
    geocode("Oslo", {
      http: mockHttp(null, { status: 500 }),
    }),
    GeocodeError
  );
});

test("throws GeocodeError when match lacks coordinates", async () => {
  await assert.rejects(
    geocode("Oslo", {
      http: mockHttp({ navn: [{ navneobjekttype: "Fylke" }] }),
    }),
    GeocodeError
  );
});
