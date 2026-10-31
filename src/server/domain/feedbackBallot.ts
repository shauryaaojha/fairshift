/**
 * One voice per person: a worker can give feedback once per team and ISO week.
 *
 * The k-anonymity gate (see anonymity.ts) counts answers, so without this one worker could send
 * three answers and unlock their team's comments alone. Each submission therefore claims a
 * ballot whose id is a keyed hash of worker, team and week. The ballot is stored apart from the
 * answer and carries nothing that links the two: no worker id, no answer id, no time. Pure.
 */

import { createHmac } from 'crypto';

/** A claimed ballot. `id` is the keyed hash; the rest scopes it for clean-up and counting. */
export interface FeedbackBallot {
  id: string;
  siteId: string;
  team: string;
  isoWeek: string;
}

/**
 * Keyed with a server secret, so the hash cannot be recomputed from a roster, and it is one-way,
 * so the ballot list does not reveal which workers answered.
 */
export function ballotId(secret: string, workerId: string, team: string, isoWeek: string): string {
  return createHmac('sha256', secret).update(`${workerId}\n${team}\n${isoWeek}`).digest('hex');
}
