'use client';

import { Button } from '@/src/components/ui/Button';

/** Opens the browser's print dialog, where the page can also be saved as a PDF. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
