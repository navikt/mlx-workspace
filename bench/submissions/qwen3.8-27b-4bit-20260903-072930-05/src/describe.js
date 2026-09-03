export function describeClouds(fractionPct) {
  if (fractionPct > 75) return 'Overcast';
  if (fractionPct > 50) return 'Partly cloudy';
  if (fractionPct > 25) return 'Mostly clear';
  return 'Clear';
}
