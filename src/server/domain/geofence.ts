/**
 * GPS check-in: haversine distance from the site gate against the site radius. Pure.
 */

import type { GeofenceResult, Site } from '../../shared/types';

const EARTH_RADIUS_METRES = 6371000;

/**
 * Computes the great-circle distance between two GPS coordinates using Haversine formula.
 * Returns distance in metres.
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METRES * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Validates whether GPS coordinates fall within the site's geofenced perimeter.
 */
export function verifyGeofence(
  workerLat: number,
  workerLng: number,
  site: Pick<Site, 'id' | 'lat' | 'lng' | 'radiusMetres'>,
): GeofenceResult {
  const distanceMetres = calculateHaversineDistance(workerLat, workerLng, site.lat, site.lng);

  const withinRadius = distanceMetres <= site.radiusMetres;

  return {
    withinRadius,
    distanceMetres,
    siteId: site.id,
  };
}
