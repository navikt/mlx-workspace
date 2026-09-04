export function parseLocation(args) {
  const tokens = args.filter((t) => t !== undefined && t !== null && String(t).trim() !== "");
  if (tokens.length === 0) {
    return { kind: "none" };
  }
  if (tokens.length === 2) {
    const [a, b] = tokens.map((t) => Number(t));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { kind: "coords", lat: a, lon: b };
    }
  }
  return { kind: "name", name: tokens.join(" ") };
}

export function validateCoords({ lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: "invalid coordinates: expected 'lat lon' with decimal values" };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, error: `invalid coordinates: latitude ${lat} out of range [-90, 90]` };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, error: `invalid coordinates: longitude ${lon} out of range [-180, 180]` };
  }
  return { ok: true };
}
