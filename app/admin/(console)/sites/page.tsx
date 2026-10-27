import { Suspense } from "react";
import Link from "next/link";
import { getAdminContext } from "../../_lib/context";
import { SECTORS, getSitesData } from "@/src/server/services/adminUi";
import { LineReveal } from "@/src/components/motion/LineReveal";

async function Sites() {
  const ctx = await getAdminContext();
  const groups = await getSitesData(ctx.allowedSectors);

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">Demo data</p>
        <LineReveal as="h1" className="page-title" immediate>
          Sites and gate kiosks
        </LineReveal>
        <p className="page-sub">
          Open a kiosk on a tablet or screen at the gate. Its QR code changes every 60 seconds, so a photo of it
          cannot be used later.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.sector} className="panel section" aria-labelledby={`sites-${g.sector}`}>
          <LineReveal as="h2" className="section-title">
            <span id={`sites-${g.sector}`}>
              {SECTORS[g.sector].label} · {SECTORS[g.sector].place}
              {g.sector === ctx.sector.key ? " (viewing)" : ""}
            </span>
          </LineReveal>
          {g.sites.map((s) => (
            <div key={s.id} className="site-row">
              <div>
                <p>
                  <strong>{s.name}</strong>
                </p>
                <p className="text-small muted">
                  Geofence <span className="mono">{s.radiusMetres} m</span>
                </p>
              </div>
              <Link href={`/admin/sites/${encodeURIComponent(s.id)}/kiosk`} className="btn-primary btn-small" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Open gate kiosk
              </Link>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Sites />
    </Suspense>
  );
}
