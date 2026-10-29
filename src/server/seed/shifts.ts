/**
 * Demo shifts for the last three weeks: some workers overworked, others with missed days.
 */
import type { Worker, Shift } from '../../shared/types';
import { DAY_MS } from '../domain/time';

/** Roster positions of the deliberately overworked demo workers (1 = Ramesh's first crew-mate, 35 = a campus worker). */
const OVERWORKED_INDEXES = new Set([1, 4, 35]);

export function generateShifts(
  workers: Worker[],
  baseTimestamp: number,
  rand: () => number,
): Shift[] {
  const shifts: Shift[] = [];
  let shiftCount = 1;

  for (let dayOffset = 21; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(baseTimestamp - dayOffset * DAY_MS);
    const dateStr = dayDate.toISOString().slice(0, 10);

    for (const [index, worker] of workers.entries()) {
      // A few workers are deliberately overworked (no rest day, 11 h shifts) so the
      // fatigue and quit-risk engines have real cases to flag. Everyone else gets a
      // weekly rest day, like a normal roster.
      const overworked = OVERWORKED_INDEXES.has(index);
      if (!overworked && dayOffset > 0 && dayDate.getUTCDay() === index % 7) continue;

      // 85% attendance probability
      if (!overworked && rand() > 0.85 && dayOffset > 0) continue;

      // For today (dayOffset === 0), mark selected workers as on-site right now.
      // The primary construction demo worker starts checked out so the check-in flow can be shown.
      if (dayOffset === 0) {
        if (worker.id === 'worker-ramesh') continue;
        if (worker.id === 'worker-murugan' || rand() > 0.3) {
          shifts.push({
            id: `shift-${shiftCount++}`,
            workerId: worker.id,
            siteId: worker.siteId,
            orgId: worker.orgId,
            checkIn: `${dateStr}T02:30:00.000Z`,
            checkOut: null, // Still on site now!
            method: 'qr',
          });
        }
        continue;
      }

      // Past shifts: variation in shift hours to generate overtime & fatigue
      // Normal shift 8h, 20% of shifts run 9-11h
      const durationHours = overworked ? 11 : rand() < 0.08 ? 9.5 + Math.floor(rand() * 2) : 8;
      // Every shift starts at 08:00 IST (02:30 UTC).
      const checkInMs = Date.parse(`${dateStr}T02:30:00.000Z`);

      shifts.push({
        id: `shift-${shiftCount++}`,
        workerId: worker.id,
        siteId: worker.siteId,
        orgId: worker.orgId,
        checkIn: new Date(checkInMs).toISOString(),
        checkOut: new Date(checkInMs + durationHours * 60 * 60 * 1000).toISOString(),
        method: rand() > 0.2 ? 'qr' : 'gps',
      });
    }
  }

  return shifts;
}
