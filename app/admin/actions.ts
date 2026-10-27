"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminLoginSchema } from "@/src/shared/schemas";
import { adminService } from "@/src/server/services/adminService";
import { checkLoginLimit, recordLoginFailure } from "@/src/server/auth/rateLimit";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/src/server/auth/session";
import {
  SECTOR_COOKIE_NAME,
  acknowledgeHazardForOrg,
  confirmHazardSeverity,
  isSeverity,
  resolveHazardForOrg,
  resolveSector,
  sectorForOrg,
} from "@/src/server/services/adminUi";
import { getAdminContext } from "./_lib/context";

export interface LoginState {
  ok: boolean;
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your email and password." };
  }

  const limit = checkLoginLimit("admin", await headers(), parsed.data.email);
  if (!limit.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` };
  }

  try {
    const { admin, token } = await adminService.login(parsed.data.email, parsed.data.password);
    const jar = await cookies();
    jar.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    jar.set({
      name: SECTOR_COOKIE_NAME,
      value: sectorForOrg(admin.orgId),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return { ok: true };
  } catch {
    recordLoginFailure("admin", parsed.data.email);
    return { ok: false, error: "Wrong email or password." };
  }
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}

export async function setSectorAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const sector = resolveSector(String(formData.get("sector") ?? ""));
  if (!ctx.allowedSectors.includes(sector)) return;
  const jar = await cookies();
  jar.set({
    name: SECTOR_COOKIE_NAME,
    value: sector,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  revalidatePath("/admin", "layout");
}

export async function acknowledgeAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  await acknowledgeHazardForOrg(String(formData.get("id") ?? ""), ctx.sector.orgId);
  revalidatePath("/admin", "layout");
}

export async function resolveAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  await resolveHazardForOrg(String(formData.get("id") ?? ""), ctx.sector.orgId);
  revalidatePath("/admin", "layout");
}

export async function confirmSeverityAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const severity = formData.get("severity");
  if (!isSeverity(severity)) return;
  await confirmHazardSeverity(String(formData.get("id") ?? ""), ctx.sector.orgId, severity);
  revalidatePath("/admin", "layout");
}
