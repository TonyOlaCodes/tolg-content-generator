import { describe, expect, it } from "vitest";
import { awardXp, levelFromXp, xpForLevel, xpProgress } from "@/lib/progression";
import { defaultProfile } from "@/lib/storage/local";

describe("progression", () => {
  it("computes ascending xp thresholds", () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(levelFromXp(0)).toBe(1);
  });

  it("awards xp and skill xp", () => {
    const profile = defaultProfile();
    const next = awardXp(profile, 100, ["rhyming", "flow"]);
    expect(next.xp).toBe(100);
    expect(next.skillXp.rhyming).toBeGreaterThan(0);
    expect(xpProgress(next.xp).level).toBeGreaterThanOrEqual(1);
  });
});
