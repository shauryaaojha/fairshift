'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { InstallIcon } from '@/src/components/icons';

/** Chrome's install event; not yet in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const noopSubscribe = () => () => {};

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * "Add to home screen" button. On Android Chrome it opens the browser's install
 * prompt; on iPhone (no install API) it shows the Share → Add to Home Screen steps.
 * Hidden when the app is already installed or the browser can't install it.
 */
export function InstallButton({
  label,
  iosHint,
  className = '',
}: {
  label: string;
  iosHint: string;
  className?: string;
}) {
  const installed = useSyncExternalStore(noopSubscribe, isStandalone, () => true);
  const ios = useSyncExternalStore(noopSubscribe, isIos, () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || done || (!deferred && !ios)) return null;

  async function install() {
    if (!deferred) {
      setShowHint((open) => !open);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setDone(true);
    setDeferred(null);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={install}
        aria-expanded={deferred ? undefined : showHint}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border-2 border-ink bg-card px-4 text-label font-semibold text-ink"
      >
        <InstallIcon size={22} />
        {label}
      </button>
      {showHint && (
        <p role="status" className="mt-2 text-small text-muted">
          {iosHint}
        </p>
      )}
    </div>
  );
}
