import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { TransitionProvider } from '@/src/components/motion/TransitionProvider';
import '@/src/components/admin/admin.css';

export const metadata: Metadata = {
  title: 'FairShift console',
  description: 'Live attendance, hazards, feedback and quit-risk for supervisors.',
};

// TransitionRouter reads usePathname(), so with Cache Components it has to sit inside
// Suspense. Every admin page reads the session cookie anyway, so nothing static is lost.
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TransitionProvider>{children}</TransitionProvider>
    </Suspense>
  );
}
