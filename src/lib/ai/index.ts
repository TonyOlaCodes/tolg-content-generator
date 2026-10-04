import type { AIProvider } from "@/lib/ai/types";
import { MockAIProvider } from "@/lib/ai/mock-provider";

/** Client-safe default — always mock. Server routes may swap in OpenAI. */
export function getClientAI(): AIProvider {
  return new MockAIProvider();
}

export async function getServerAI(): Promise<AIProvider> {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    const { OpenAIProvider } = await import("@/lib/ai/openai-provider");
    return new OpenAIProvider(key, process.env.OPENAI_MODEL || "gpt-4o-mini");
  }
  return new MockAIProvider();
}

export type { AIProvider };
