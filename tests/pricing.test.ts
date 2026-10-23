import { describe, expect, it } from "vitest";
import { pricing } from "@/lib/config/pricing";

describe("pricing config", () => {
  it("exposes EUR currency", () => {
    expect(pricing.currency).toBe("EUR");
  });

  it("has positive proposed plan amounts", () => {
    expect(pricing.starterMonthlyEur).toBeGreaterThan(0);
    expect(pricing.growthMonthlyEur).toBeGreaterThan(0);
    expect(pricing.setupFeeEur).toBeGreaterThan(0);
  });

  it("keeps Growth above Starter by default", () => {
    expect(pricing.growthMonthlyEur).toBeGreaterThanOrEqual(pricing.starterMonthlyEur);
  });
});
