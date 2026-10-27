import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { getAdminContext } from "../_lib/context";
import { logoutAction, setSectorAction } from "../actions";
import { AdminRail } from "@/src/components/admin/AdminRail";
import { SectorSwitcher } from "@/src/components/admin/SectorSwitcher";
import { ADMIN_NAV } from "@/src/components/admin/nav";
import { StairsMenu } from "@/src/components/motion/StairsMenu";

async function Shell({ children }: { children: ReactNode }) {
  const ctx = await getAdminContext();
  const sectorKey = ctx.sector.key;

  const footer = (
    <>
      <SectorSwitcher current={sectorKey} allowed={ctx.allowedSectors} action={setSectorAction} />
      <form action={logoutAction}>
        <button type="submit" className="btn-quiet">
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="admin-brand">
          FairShift
        </Link>
        <div className="hidden-below-lg">
          <SectorSwitcher current={sectorKey} allowed={ctx.allowedSectors} action={setSectorAction} />
        </div>
        <div className="admin-who">
          <StairsMenu items={ADMIN_NAV.map((n) => ({ href: n.href, label: n.label }))} footer={footer} />
          <form action={logoutAction} className="hidden-below-lg">
            <button type="submit" className="btn-quiet btn-small">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AdminRail sector={sectorKey} />
      <div className="admin-main" id="admin-content">
        {children}
      </div>
    </div>
  );
}

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="admin-main text-body">Opening the console.</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
