import type { Metadata, Viewport } from 'next';
import { Anek_Latin, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/src/components/pwa/ServiceWorkerRegister';

const anekLatin = Anek_Latin({
  variable: '--font-anek',
  subsets: ['latin'],
  display: 'swap',
  axes: ['wdth'],
});

const splineSansMono = Spline_Sans_Mono({
  variable: '--font-mono-display',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FairShift — Fair pay. Safe sites. A voice that counts.',
  description:
    'Digital platform for fair wages, safe workplaces and worker voice across construction sites and college campuses. SDG 8.',
  applicationName: 'FairShift',
  appleWebApp: { capable: true, title: 'FairShift', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#1F3FB5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anekLatin.variable} ${splineSansMono.variable}`}>
      <body className="font-sans min-h-dvh flex flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <main id="main" className="flex-1 flex flex-col">
          {children}
        </main>
        <footer className="text-small text-center py-4 text-muted">Demo data · FairShift</footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
