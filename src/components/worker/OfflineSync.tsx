'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '@/src/i18n/client';
import {
  getActiveWorkerId,
  getOutboxStore,
  setActiveWorkerId,
  type OutboxItem,
} from '@/src/lib/offline/outbox';
import { flushOutbox, type SyncHandlerResult, type SyncHandlers } from '@/src/lib/offline/sync';
import {
  checkInAction,
  checkOutAction,
  reportHazardAction,
  submitFeedbackAction,
  type CheckinInput,
  type FeedbackInput,
  type HazardInput,
} from '@/app/w/actions';

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
const getOnline = () => navigator.onLine;
/**
 * The server cannot know the phone's connection, so it renders "online". Reading
 * `navigator.onLine` during render is wrong on the server: Node 22 defines a global `navigator`
 * without `onLine`, which made every worker page server-render the offline banner.
 */
const getServerOnline = () => true;

/** Replays keep the original capture time and use the outbox id as the idempotency key. */
function stamp(item: OutboxItem): { capturedAt: string; clientId: string } {
  return { capturedAt: item.capturedAt, clientId: item.id };
}

/**
 * Run one replay. Every action returns `{ ok }` or an `ActionFailure` carrying `permanent`;
 * a thrown error means the request never reached the server, so the item is kept for retry.
 */
async function send(
  call: () => Promise<{ ok: true } | { ok: false; permanent: boolean; reason: string }>,
): Promise<SyncHandlerResult> {
  try {
    const res = await call();
    if (res.ok) return { ok: true };
    return { ok: false, permanent: res.permanent, retryable: !res.permanent, reason: res.reason };
  } catch (err) {
    return { ok: false, retryable: true, reason: err instanceof Error ? err.message : String(err) };
  }
}

interface Props {
  workerId: string | null;
}

type SyncState = 'idle' | 'syncing' | 'all-sent' | 'rejected';

export function OfflineSync({ workerId }: Props) {
  const t = useT();
  const isOnline = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [rejectedInfo, setRejectedInfo] = useState<{ count: number; reason: string } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveWorkerId = workerId || getActiveWorkerId();

  // Keep active worker id in local storage for forms
  useEffect(() => {
    if (workerId) {
      setActiveWorkerId(workerId);
    }
  }, [workerId]);

  const refreshCount = useCallback(async () => {
    if (!effectiveWorkerId) return;
    try {
      const items = await getOutboxStore().list(effectiveWorkerId);
      setOutboxCount(items.length);
    } catch {
      // ignore
    }
  }, [effectiveWorkerId]);

  const runFlush = useCallback(async () => {
    if (!effectiveWorkerId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      await refreshCount();
      return;
    }

    const store = getOutboxStore();
    const items = await store.list(effectiveWorkerId);
    if (items.length === 0) {
      setOutboxCount(0);
      return;
    }

    setSyncState('syncing');

    const handlers: SyncHandlers = {
      checkin: (item) =>
        send(() => checkInAction({ ...(item.payload as CheckinInput), ...stamp(item) })),
      // No shift id: the server closes the worker's open shift, which an earlier replayed
      // check-in may have just created.
      checkout: (item) => send(() => checkOutAction(stamp(item))),
      hazard: (item) =>
        send(() => reportHazardAction({ ...(item.payload as HazardInput), ...stamp(item) })),
      feedback: (item) =>
        send(() => submitFeedbackAction({ ...(item.payload as FeedbackInput), ...stamp(item) })),
    };

    try {
      const result = await flushOutbox(store, effectiveWorkerId, handlers);
      await refreshCount();

      if (result.permanentFailures.length > 0) {
        setRejectedInfo({
          count: result.permanentFailures.length,
          reason: result.permanentFailures[0].reason || 'Rejected by server',
        });
        setSyncState('rejected');
      } else if (result.succeeded > 0) {
        setSyncState('all-sent');
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setSyncState('idle');
        }, 4000);
      } else {
        setSyncState('idle');
      }
    } catch {
      setSyncState('idle');
      await refreshCount();
    }
  }, [effectiveWorkerId, refreshCount]);

  useEffect(() => {
    let active = true;

    void (async () => {
      await refreshCount();
      if (active) {
        await runFlush();
      }
    })();

    const handleOnline = () => {
      runFlush();
    };

    const handleOffline = () => {
      setSyncState('idle');
      refreshCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCount();
        runFlush();
      }
    };

    const handleOutboxChange = () => {
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('fairshift:outbox-change', handleOutboxChange);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('fairshift:outbox-change', handleOutboxChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [refreshCount, runFlush]);

  // Determine what to display
  let bannerMessage: string | null = null;
  let dotColor = 'bg-cleared';

  if (!isOnline) {
    const offlineNote = t('offline.bannerOffline');
    if (outboxCount > 0) {
      bannerMessage = `${offlineNote} ${t('offline.bannerSaved', { n: String(outboxCount) })}`;
    } else {
      bannerMessage = offlineNote;
    }
    dotColor = 'bg-hivis';
  } else if (syncState === 'syncing') {
    bannerMessage = t('offline.bannerSyncing');
    dotColor = 'bg-ink';
  } else if (syncState === 'all-sent') {
    bannerMessage = t('offline.bannerAllSent');
    dotColor = 'bg-cleared';
  } else if (syncState === 'rejected' && rejectedInfo) {
    bannerMessage = t('offline.bannerRejected', {
      n: String(rejectedInfo.count),
      reason: rejectedInfo.reason,
    });
    dotColor = 'bg-escalated';
  }

  if (!bannerMessage) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex min-h-12 w-full items-center justify-between gap-3 border-b-2 border-graphite bg-paper px-4 py-2 text-label font-semibold text-graphite"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 rounded-full border-2 border-graphite ${dotColor}`}
        />
        <span className="leading-snug">{bannerMessage}</span>
      </div>
      {syncState === 'rejected' ? (
        <button
          type="button"
          onClick={() => setSyncState('idle')}
          className="inline-flex min-h-12 min-w-12 items-center justify-center text-label text-graphite underline underline-offset-4"
          aria-label={t('common.close')}
        >
          {t('common.close')}
        </button>
      ) : null}
    </div>
  );
}
