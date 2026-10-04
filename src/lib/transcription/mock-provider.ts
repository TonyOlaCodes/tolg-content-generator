import type { TranscriptionProvider } from "@/lib/transcription/types";
import type { TranscriptSegment } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Development transcription stub.
 * Swap for Whisper / Web Speech / cloud STT behind the same interface.
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(blob: Blob): Promise<{ text: string; segments: TranscriptSegment[] }> {
    const durationSec = Math.max(15, Math.min(180, blob.size / 4000));
    const lines = [
      "clock ticking in the room so I spit what I see",
      "turn the mirror to a portal then I leap out free",
      "twenty three in my vision then I'm airborne clean",
      "bull market in my pocket from the chicago dream",
      "if I stall I grab the bottle change the topic to steam",
      "ride the ocean of the motion keep the potion in theme",
    ];
    const slice = lines.slice(0, Math.max(2, Math.floor(durationSec / 12)));
    const text = slice.join(". ") + ".";
    let t = 0;
    const segments: TranscriptSegment[] = slice.map((line) => {
      const startMs = t * 1000;
      const endMs = (t + 4) * 1000;
      t += 4;
      return { id: uid("seg"), startMs, endMs, text: line, confidence: 0.55 };
    });
    return { text, segments };
  }
}

export const mockTranscription = new MockTranscriptionProvider();
