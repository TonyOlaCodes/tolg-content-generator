import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/lib/ai/mock-provider";

describe("MockAIProvider", () => {
  it("returns structured analysis with skill scores", async () => {
    const ai = new MockAIProvider();
    const analysis = await ai.analyzeFreestyle({
      recordingId: "rec_test",
      transcript:
        "twenty three in the air like jordan then the bulls turn into a bull market for money",
      session: { durationSec: 60, prompts: ["jordan"], mode: "free", difficulty: "beginner" },
    });
    expect(analysis.overallScore).toBeGreaterThan(0);
    expect(analysis.skills.references).toBeGreaterThan(0);
    expect(analysis.missedOpportunities.length).toBeGreaterThan(0);
    expect(analysis.summary.toLowerCase()).not.toContain("great freestyle");
  });

  it("labels uncertain double meanings carefully", async () => {
    const ai = new MockAIProvider();
    const result = await ai.evaluateWordplay("I walked into court", "court");
    expect(typeof result.score).toBe("number");
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
