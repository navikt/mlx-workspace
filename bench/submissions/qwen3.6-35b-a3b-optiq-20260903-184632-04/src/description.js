export function deriveDescription(instant) {
  const details = instant.details || {};
  const cloudAreaFraction = details.cloud_area_fraction;

  if (cloudAreaFraction === undefined || cloudAreaFraction === null) {
    return 'Unknown';
  }

  if (cloudAreaFraction > 75) {
    return 'Overcast';
  } else if (cloudAreaFraction > 50) {
    return 'Partly cloudy';
  } else if (cloudAreaFraction > 25) {
    return 'Mostly clear';
  } else {
    return 'Clear';
  }
}
