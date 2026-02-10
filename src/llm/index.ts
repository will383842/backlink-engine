import { LlmClient } from "./llmClient.js";

let instance: LlmClient | null = null;

/**
 * Get (or create) the singleton LLM client.
 */
export function getLlmClient(): LlmClient {
  if (!instance) {
    instance = new LlmClient();
  }
  return instance;
}

/**
 * Reset the singleton. Call this after AI settings change
 * (e.g. API key update, enabled toggle).
 */
export function resetLlmClient(opts?: {
  apiKey?: string;
  enabled?: boolean;
  model?: string;
}): void {
  instance = new LlmClient(opts);
}
