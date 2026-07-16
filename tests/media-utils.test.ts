import { describe, expect, it } from "vitest";

import {
  computeAspectRatio,
  detectOrientation,
  formatAspectRatio,
  slugify,
} from "@/lib/utils";

describe("image geometry helpers", () => {
  it("computes aspect ratio", () => {
    expect(computeAspectRatio(1080, 1920)).toBeCloseTo(0.5625);
  });

  it("detects orientation", () => {
    expect(detectOrientation(1080, 1920)).toBe("PORTRAIT");
    expect(detectOrientation(1920, 1080)).toBe("LANDSCAPE");
    expect(detectOrientation(1000, 1000)).toBe("SQUARE");
  });

  it("formats common aspect ratios", () => {
    expect(formatAspectRatio(9 / 16)).toBe("9:16");
    expect(formatAspectRatio(1)).toBe("1:1");
  });
});

describe("slugify", () => {
  it("normalizes tag names", () => {
    expect(slugify("Higher Body Fat")).toBe("higher-body-fat");
  });
});
