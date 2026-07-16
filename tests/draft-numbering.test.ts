import { describe, expect, it } from "vitest";

import { formatDraftName } from "@/lib/utils";

describe("formatDraftName", () => {
  it("pads draft numbers to three digits", () => {
    expect(formatDraftName(1)).toBe("post_001");
    expect(formatDraftName(12)).toBe("post_012");
    expect(formatDraftName(100)).toBe("post_100");
  });
});
