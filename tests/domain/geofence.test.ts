import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, verifyGeofence } from '../../src/server/domain/geofence';

describe('Domain: Geofence Engine', () => {
  // Chennai site coordinates: 13.0827° N, 80.2707° E
  const site = {
    id: 'site-chennai',
    lat: 13.0827,
    lng: 80.2707,
    radiusMetres: 200,
  };

  it('calculates near-zero distance for identical coordinates', () => {
    const dist = calculateHaversineDistance(13.0827, 80.2707, 13.0827, 80.2707);
    expect(dist).toBe(0);
  });

  it('approves check-in within site radius', () => {
    // 50m north offset (~0.00045 degrees lat)
    const workerLat = 13.0831;
    const workerLng = 80.2707;
    const res = verifyGeofence(workerLat, workerLng, site);
    expect(res.withinRadius).toBe(true);
    expect(res.distanceMetres).toBeLessThan(200);
  });

  it('rejects check-in outside site radius', () => {
    // 1 km away
    const workerLat = 13.0927;
    const workerLng = 80.2707;
    const res = verifyGeofence(workerLat, workerLng, site);
    expect(res.withinRadius).toBe(false);
    expect(res.distanceMetres).toBeGreaterThan(1000);
  });
});
