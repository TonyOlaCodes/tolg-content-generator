import { describe, expect, it } from "vitest";
import {
  BLOCKING_APPOINTMENT_STATUSES,
  rangesOverlap,
} from "@/lib/appointments/conflicts";

describe("rangesOverlap", () => {
  const t = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

  it("detects overlapping intervals", () => {
    expect(rangesOverlap(t(10), t(12), t(11), t(13))).toBe(true);
  });

  it("returns false when adjacent but not overlapping", () => {
    expect(rangesOverlap(t(10), t(11), t(11), t(12))).toBe(false);
  });

  it("returns false when fully before", () => {
    expect(rangesOverlap(t(9), t(10), t(11), t(12))).toBe(false);
  });

  it("returns true when one range contains the other", () => {
    expect(rangesOverlap(t(9), t(15), t(10), t(11))).toBe(true);
  });
});

describe("BLOCKING_APPOINTMENT_STATUSES", () => {
  it("includes statuses that block the calendar", () => {
    expect(BLOCKING_APPOINTMENT_STATUSES).toEqual(
      expect.arrayContaining(["CONFIRMED", "PENDING", "REQUESTED"]),
    );
    expect(BLOCKING_APPOINTMENT_STATUSES).not.toContain("CANCELLED");
    expect(BLOCKING_APPOINTMENT_STATUSES).not.toContain("COMPLETED");
  });
});
