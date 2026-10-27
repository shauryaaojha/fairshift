'use client';

import { useState } from 'react';
import { ShareIcon } from '@/src/components/icons';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n/client';

/** Shares (or copies) the public verify link for one credential. */
export function ShareLink({ path, title }: { path: string; title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The person closed the share sheet: nothing to do.
    }
  }

  return (
    <Button variant="secondary" fullWidth onClick={share} aria-live="polite">
      <ShareIcon />
      {copied ? t('skills.copied') : t('skills.share')}
    </Button>
  );
}
