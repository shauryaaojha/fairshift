import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/src/server/services/workerService", () => ({ workerService: {} }));
vi.mock("@/src/server/repos", () => ({ getDatabase: vi.fn() }));
vi.mock("@/src/server/ai/gemini", () => ({ explainPayslip: vi.fn() }));

import {
  buildPayslipSpeech,
  checkinErrorCode,
  describeFatigue,
  formatClock,
  formatDay,
  hazardTimeline,
  summarizeWeek,
} from "@/src/server/services/workerUi";
import type { FatigueFlag, PayslipResult, Shift } from "@/src/shared/types";

const shift = (id: string, inIso: string, outIso: string | null): Shift => ({
  id,
  workerId: "w1",
  siteId: "s1",
  orgId: "o1",
  checkIn: inIso,
  checkOut: outIso,
  method: "qr",
});

describe("formatClock / formatDay", () => {
  it("formats in site time (IST)", () => {
    expect(formatClock("2026-10-27T02:32:00.000Z")).toBe("08:02");
    expect(formatClock("not a date")).toBe("--:--");
  });

  it("formats date-only strings without shifting the day", () => {
    expect(formatDay("2026-10-20", "en")).toMatch(/20/);
    expect(formatDay("2026-10-20", "hi")).toMatch(/20/);
    expect(formatDay("garbage", "en")).toBe("garbage");
  });
});

describe("describeFatigue", () => {
  it("renders every domain flag as a plain sentence in each language", () => {
    const flags: FatigueFlag[] = [
      { type: "long_shift", messageKey: "fatigue.long_shift", params: { hours: 11, shiftId: "s", date: "2026-10-20" } },
      { type: "weekly_hours_exceeded", messageKey: "fatigue.weekly_hours_exceeded", params: { totalHours: 52, limit: 48 } },
      { type: "short_rest", messageKey: "fatigue.short_rest", params: { gapHours: 6, date: "2026-10-21", minGap: 10 } },
      { type: "no_rest_day", messageKey: "fatigue.no_rest_day", params: { consecutiveDays: 7 } },
    ];
    for (const loc of ["en", "hi", "ta"] as const) {
      const notes = describeFatigue(flags, loc);
      expect(notes).toHaveLength(4);
      for (const n of notes) expect(n.text).not.toMatch(/\{\w+\}|fatigue\./);
    }
    expect(describeFatigue(flags, "en")[0].text).toContain("11 hours");
    expect(describeFatigue(flags, "ta")[3].text).toContain("7");
  });
});

describe("hazardTimeline", () => {
  const base = { reportedAt: "2026-10-27T05:00:00Z", acknowledgedAt: null, resolvedAt: null };

  it("a new report is logged with only the first step done", () => {
    const tl = hazardTimeline({ ...base, status: "reported" });
    expect(tl.steps.map((s) => s.key)).toEqual(["reported", "acknowledged", "resolved"]);
    expect(tl.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(tl.stamp).toEqual({ variant: "hivis", labelKey: "hazard.stamp.logged" });
  });

  it("an escalated report adds an escalated node and an escalated stamp", () => {
    const tl = hazardTimeline({ ...base, status: "escalated" });
    expect(tl.steps.map((s) => s.key)).toEqual(["reported", "escalated", "acknowledged", "resolved"]);
    expect(tl.steps[1].done).toBe(true);
    expect(tl.stamp.variant).toBe("escalated");
  });

  it("a resolved report has every step done and a cleared stamp", () => {
    const tl = hazardTimeline({
      status: "resolved",
      reportedAt: base.reportedAt,
      acknowledgedAt: "2026-10-27T05:30:00Z",
      resolvedAt: "2026-10-27T08:00:00Z",
    });
    expect(tl.steps.every((s) => s.done)).toBe(true);
    expect(tl.stamp.variant).toBe("cleared");
  });
});

describe("buildPayslipSpeech", () => {
  const payslip: PayslipResult = {
    lines: [
      { key: "payslip.basePay", label: "Base Pay", amount: 15000, type: "earning" },
      { key: "payslip.pf", label: "PF", amount: 1800, type: "deduction" },
      { key: "payslip.net", label: "Net", amount: 13200, type: "total" },
    ],
    gross: 15000,
    totalDeductions: 1800,
    net: 13200,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-27",
  };

  it("speaks each line and the net, using only engine numbers", () => {
    const en = buildPayslipSpeech(payslip, "en");
    expect(en).toContain("Base pay, 15,000 rupees.");
    expect(en).toContain("Net pay, 13,200 rupees.");
    expect(en.match(/13,200/g)).toHaveLength(1);
  });

  it("speaks in Hindi and Tamil", () => {
    expect(buildPayslipSpeech(payslip, "hi")).toContain("रुपये");
    expect(buildPayslipSpeech(payslip, "ta")).toContain("ரூபாய்");
  });
});

describe("checkinErrorCode", () => {
  it("maps backend messages to translatable codes", () => {
    expect(checkinErrorCode("Invalid or expired 6-digit site check-in code")).toBe("invalid_code");
    expect(checkinErrorCode("Outside site geofence (400m from site gate)")).toBe("outside");
    expect(checkinErrorCode("boom")).toBe("generic");
  });
});

describe("summarizeWeek", () => {
  const now = new Date("2026-10-27T10:00:00Z");

  it("keeps the last 7 days newest first and counts overtime past 8 h", () => {
    const week = summarizeWeek(
      [
        shift("old", "2026-10-10T03:00:00Z", "2026-10-10T11:00:00Z"),
        shift("a", "2026-10-25T03:00:00Z", "2026-10-25T13:00:00Z"),
        shift("b", "2026-10-26T03:00:00Z", "2026-10-26T11:00:00Z"),
        shift("open", "2026-10-27T03:00:00Z", null),
      ],
      now,
    );
    expect(week.rows.map((r) => r.id)).toEqual(["open", "b", "a"]);
    expect(week.rows[0].open).toBe(true);
    expect(week.rows[2].hours).toBe(10);
    expect(week.overtime.overtimeHours).toBe(2);
    expect(week.totalHours).toBe(18);
  });

  it("is empty when there are no recent shifts", () => {
    const week = summarizeWeek([shift("old", "2026-09-01T03:00:00Z", "2026-09-01T11:00:00Z")], now);
    expect(week.rows).toEqual([]);
    expect(week.totalHours).toBe(0);
  });
});
