import type { MetadataRoute } from 'next';

/** Web app manifest: makes FairShift installable on a worker's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/w',
    name: 'FairShift: fair pay, safe sites',
    short_name: 'FairShift',
    description:
      'Check in, see your payslip, report danger and give anonymous feedback, in English, Hindi or Tamil.',
    start_url: '/w',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2F3EE',
    theme_color: '#1F3FB5',
    lang: 'en-IN',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Check in',
        url: '/w/checkin',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Report danger',
        url: '/w/hazard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      { name: 'My pay', url: '/w/pay', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
