'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/app/w/actions';

interface Props {
  label: string;
}

export function LogoutButton({ label }: Props) {
  const [pending, startTransition] = useTransition();

  async function handleLogout(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined' && typeof caches !== 'undefined') {
      try {
        await caches.delete('fairshift-pages');
      } catch {
        // Ignore cache deletion errors in unsupported environments
      }
    }
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <form action={logoutAction} onSubmit={handleLogout}>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center text-label font-semibold text-ink underline underline-offset-4"
      >
        {label}
      </button>
    </form>
  );
}
