"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchForecast,
  closestEntry,
  extractDetails,
  WeatherError,
  METNO_URL,
} = require("../src/weather");

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

const body = {
  properties: {
    timeseries: [
      { time: "2026-09-03T05:00:00Z", data: { instant: { details: { air_temperature: 10.8 } } } },
      { time: "2026-09-03T06:00:00Z", data: { instant: { details: { air_temperature: 11.2 } } } },
    ],
  },
};

test("fetchForecast returns the response body", async () => {
  const data = await fetchForecast(59.91, 10.75, {
    userAgent: "weather-cli/1.0 test",
    http: mockHttp(body),
  });
  assert.equal(data.properties.timeseries.length, 2);
});

test("fetchForecast sends the User-Agent header", async () => {
  let seenHeaders = null;
  const http = {
    async get(url, cfg) {
      seenHeaders = cfg.headers;
      return { status: 200, data: body };
    },
  };
  await fetchForecast(1, 2, { userAgent: "weather-cli/1.0 contact", http });
  assert.equal(seenHeaders["User-Agent"], "weather-cli/1.0 contact");
});

test("fetchForecast surfaces 403 as non-retryable", async () => {
  await assert.rejects(
    fetchForecast(1, 2, { http: mockHttp(null, { status: 403 }) }),
    (e) => e instanceof WeatherError && e.status === 403 && e.retryable === false
  );
});

test("fetchForecast surfaces 429 as retryable", async () => {
  await assert.rejects(
    fetchForecast(1, 2, { http: mockHttp(null, { status: 429 }) }),
    (e) => e instanceof WeatherError && e.status === 429 && e.retryable === true
  );
});

test("closestEntry picks the entry nearest to now in UTC", () => {
  const ts = [
    { time: "2026-09-03T05:00:00Z", data: { instant: { details: { t: "05" } } } },
    { time: "2026-09-03T06:00:00Z", data: { instant: { details: { t: "06" } } } },
  ];
  // 05:20 is 20 min from 05:00 but 40 min from 06:00, so 05:00 is closest.
  const now = new Date("2026-09-03T05:20:00Z");
  const e = closestEntry(ts, now);
  assert.equal(e.data.instant.details.t, "05");

  // 05:59 is 1 min from 06:00 but 59 min from 05:00, so 06:00 is closest.
  const now2 = new Date("2026-09-03T05:59:00Z");
  const e2 = closestEntry(ts, now2);
  assert.equal(e2.data.instant.details.t, "06");

  // Just past the midpoint, the later (06:00) entry is strictly closer.
  const now3 = new Date("2026-09-03T05:30:01Z");
  const e3 = closestEntry(ts, now3);
  assert.equal(e3.data.instant.details.t, "06");
});

test("closestEntry is timezone-independent (UTC epoch math)", () => {
  const ts = [
    { time: "2026-09-03T05:00:00Z", data: { instant: { details: { t: "a" } } } },
    { time: "2026-09-03T06:00:00Z", data: { instant: { details: { t: "b" } } } },
  ];
  // Same instant expressed via a different local offset must select the same entry.
  const a = closestEntry(ts, new Date("2026-09-03T05:31:34Z"));
  const b = closestEntry(ts, new Date("2026-09-03T07:31:34+02:00"));
  assert.equal(a.time, b.time);
});

test("closestEntry throws on empty timeseries", () => {
  assert.throws(() => closestEntry([]), WeatherError);
  assert.throws(() => closestEntry(undefined), WeatherError);
});

test("extractDetails returns the details object", () => {
  const d = extractDetails({ data: { instant: { details: { x: 1 } } } });
  assert.equal(d.x, 1);
});

test("extractDetails throws when details missing", () => {
  assert.throws(() => extractDetails({ data: {} }), WeatherError);
});
