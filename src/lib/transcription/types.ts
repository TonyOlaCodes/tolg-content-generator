import type { TranscriptSegment } from "@/lib/types";

export interface TranscriptionProvider {
  transcribe(blob: Blob, opts?: { language?: string }): Promise<{
    text: string;
    segments: TranscriptSegment[];
  }>;
}
