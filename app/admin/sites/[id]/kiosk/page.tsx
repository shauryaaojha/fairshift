import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "../../../_lib/context";
import { SECTORS, getKioskView } from "@/src/server/services/adminUi";
import { KioskRefresher } from "@/src/components/admin/KioskRefresher";

async function Kiosk({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const view = await getKioskView(
    decodeURIComponent(id),
    `${proto}://${host}`,
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
      <p className="mono" style={{ fontSize: "1.6rem", margin: 0 }}>
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
