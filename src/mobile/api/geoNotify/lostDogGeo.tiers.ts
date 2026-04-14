/**
 * Adaptive radius tiers for lost-dog geo notifications.
 * Clock: age since lost_dog_reports.created_at (see processor).
 *
 * Tier ids are stable for deduplication in lost_report_geo_notification_log.
 */

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MIN;

/** Upper bound of age for each tier (exclusive), except the last tier which is unbounded. */
export const LOST_DOG_GEO_TIERS = [
  { tierId: 0, maxAgeMs: 15 * MS_PER_MIN, radiusM: 500 },
  { tierId: 1, maxAgeMs: 60 * MS_PER_MIN, radiusM: 2000 },
  { tierId: 2, maxAgeMs: 6 * MS_PER_HOUR, radiusM: 5000 },
  { tierId: 3, maxAgeMs: 24 * MS_PER_HOUR, radiusM: 10_000 },
  { tierId: 4, maxAgeMs: Number.POSITIVE_INFINITY, radiusM: 20_000 },
] as const;

export type LostDogGeoTier = {
  tierId: number;
  radiusM: number;
};

/**
 * Returns the active tier for a report age in milliseconds.
 * ageMs = Date.now() - report.created_at.getTime()
 */
export function tierForAgeMs(ageMs: number): LostDogGeoTier | null {
  if (ageMs < 0) {
    return null;
  }
  for (const t of LOST_DOG_GEO_TIERS) {
    if (ageMs < t.maxAgeMs) {
      return { tierId: t.tierId, radiusM: t.radiusM };
    }
  }
  const last = LOST_DOG_GEO_TIERS[LOST_DOG_GEO_TIERS.length - 1];
  return { tierId: last.tierId, radiusM: last.radiusM };
}

/** Earth mean radius in meters (WGS84 approximation). */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle distance between two WGS84 points in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
