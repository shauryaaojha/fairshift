import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminContext } from '../../../_lib/context';
import { SECTORS } from '@/src/server/services/sectors';
import { getKioskView } from '@/src/server/services/adminPages';
import { requestOrigin } from '@/src/server/origin';
import { KioskRefresher } from '@/src/components/admin/KioskRefresher';

async function Kiosk({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const view = await getKioskView(
    decodeURIComponent(id),
    await requestOrigin(),
    ctx.allowedSectors.map((key) => SECTORS[key].orgId),
  );
  if (!view) notFound();

  return (
    <section className="kiosk" aria-label="Gate check-in kiosk">
      <h1>Scan to check in at {view.site.name}</h1>
      <div
        className="kiosk-qr"
        role="img"
        aria-label={`QR code for check-in at ${view.site.name}. Current code ${view.code}.`}
        // Server-generated SVG from the qrcode package, not user input.
        dangerouslySetInnerHTML={{ __html: view.qrSvg }}
      />
      <p className="mono" style={{ fontSize: '1.6rem', margin: 0 }}>
        {view.code}
      </p>
      <KioskRefresher validUntil={view.validUntil} />
      <Link href="/admin/sites" className="link text-small">
        Leave kiosk
      </Link>
    </section>
  );
}

export default function KioskPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="kiosk">Loading the gate code.</p>}>
      <Kiosk params={params} />
    </Suspense>
  );
}
