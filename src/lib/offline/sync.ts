import type { OutboxItem, OutboxStore } from './outbox';

export interface SyncHandlerResult {
  ok: boolean;
  permanent?: boolean;
  retryable?: boolean;
  reason?: string;
}

export interface SyncHandlers {
  checkin: (item: OutboxItem) => Promise<SyncHandlerResult>;
  checkout: (item: OutboxItem) => Promise<SyncHandlerResult>;
  hazard: (item: OutboxItem) => Promise<SyncHandlerResult>;
  feedback: (item: OutboxItem) => Promise<SyncHandlerResult>;
  onPermanentFailure?: (item: OutboxItem, reason?: string) => void;
}

export interface FlushResult {
  processed: number;
  succeeded: number;
  permanentFailures: Array<{ item: OutboxItem; reason?: string }>;
  stoppedDueToRetryable?: { item: OutboxItem; reason?: string };
  skippedMismatch: number;
  alreadyFlushing?: boolean;
}

let isFlushing = false;

export function isOutboxFlushing(): boolean {
  return isFlushing;
}

export function _resetFlushingForTests(): void {
  isFlushing = false;
}

/**
 * Replays queued outbox items for `workerId` one by one, oldest capturedAt first.
 * Concurrency is guarded so two flushes cannot run at the same time.
 */
export async function flushOutbox(
  store: OutboxStore,
  workerId: string,
  handlers: SyncHandlers,
): Promise<FlushResult> {
  if (isFlushing) {
    return {
      processed: 0,
      succeeded: 0,
      permanentFailures: [],
      skippedMismatch: 0,
      alreadyFlushing: true,
    };
  }
  isFlushing = true;

  try {
    const allItems = await store.list();

    // Replays items oldest capturedAt first (ascending)
    const sorted = [...allItems].sort(
      (a, b) => (Date.parse(a.capturedAt) || 0) - (Date.parse(b.capturedAt) || 0),
    );

    let processed = 0;
    let succeeded = 0;
    let skippedMismatch = 0;
    const permanentFailures: Array<{ item: OutboxItem; reason?: string }> = [];
    let stoppedDueToRetryable: { item: OutboxItem; reason?: string } | undefined;

    for (const item of sorted) {
      // Replays items for THIS WORKER ONLY
      if (item.workerId !== workerId) {
        skippedMismatch++;
        continue;
      }

      const handler = handlers[item.kind];
      if (!handler) {
        await store.remove(item.id);
        const reason = `No handler for kind: ${item.kind}`;
        permanentFailures.push({ item, reason });
        handlers.onPermanentFailure?.(item, reason);
        processed++;
        continue;
      }

      processed++;
      let res: SyncHandlerResult;
      try {
        res = await handler(item);
      } catch (err) {
        // Network or thrown error counts as retryable
        res = {
          ok: false,
          retryable: true,
          reason: err instanceof Error ? err.message : String(err),
        };
      }

      if (res.ok) {
        await store.remove(item.id);
        succeeded++;
      } else if (res.permanent) {
        await store.remove(item.id);
        permanentFailures.push({ item, reason: res.reason });
        handlers.onPermanentFailure?.(item, res.reason);
      } else {
        // Retryable failure (res.retryable === true or !res.ok)
        item.attempts = (item.attempts || 0) + 1;
        await store.put(item);
        stoppedDueToRetryable = { item, reason: res.reason };
        break; // STOP the loop immediately!
      }
    }

    return {
      processed,
      succeeded,
      permanentFailures,
      stoppedDueToRetryable,
      skippedMismatch,
    };
  } finally {
    isFlushing = false;
  }
}
