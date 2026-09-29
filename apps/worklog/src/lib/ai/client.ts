import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";

export type AiProvider = "anthropic" | "mock" | "unavailable";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const DEFAULT_FAST_MODEL = "claude-haiku-4-5-20251001";

/**
 * Picks the provider:
 * - AI_PROVIDER, if set, wins ("anthropic" or "mock").
 * - Otherwise Anthropic when a key is present.
 * - Otherwise mock outside production, so local dev works without a key.
 * - In production with no key it is "unavailable", and the UI offers the plain format.
 */
export function aiProvider(): AiProvider {
  const explicit = process.env.AI_PROVIDER?.trim();
  if (explicit === "mock") return "mock";
  if (explicit === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : "unavailable";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return process.env.NODE_ENV === "production" ? "unavailable" : "mock";
}

export function modelId(kind: "main" | "fast" = "main"): string {
  if (aiProvider() === "mock") return "mock";
  return kind === "fast"
    ? process.env.ANTHROPIC_FAST_MODEL || DEFAULT_FAST_MODEL
    : process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

function anthropicModel(kind: "main" | "fast") {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(modelId(kind));
}

export type ModelCall = {
  instructions: string;
  prompt: string;
  kind?: "main" | "fast";
  signal?: AbortSignal;
  maxOutputTokens?: number;
};

/** Streams plain text deltas. Throws on provider errors, including errors that arrive mid-stream. */
export async function* streamModelText(call: ModelCall): AsyncGenerator<string> {
  const result = streamText({
    model: anthropicModel(call.kind ?? "main"),
    instructions: call.instructions,
    prompt: call.prompt,
    abortSignal: call.signal,
    maxOutputTokens: call.maxOutputTokens ?? 1200,
    maxRetries: 1,
  });
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") yield part.text;
    else if (part.type === "error")
      throw part.error instanceof Error ? part.error : new Error(String(part.error));
  }
}

export async function generateModelText(call: ModelCall): Promise<string> {
  const result = await generateText({
    model: anthropicModel(call.kind ?? "main"),
    instructions: call.instructions,
    prompt: call.prompt,
    abortSignal: call.signal,
    maxOutputTokens: call.maxOutputTokens ?? 800,
    maxRetries: 1,
  });
  return result.text;
}

/** Mock mode streams a known text in small word chunks, so the UI can be built and tested offline. */
export async function* streamMockText(
  text: string,
  signal?: AbortSignal,
  delayMs = 18,
): AsyncGenerator<string> {
  const tokens = text.match(/\S+\s*|\s+/g) ?? [];
  for (let i = 0; i < tokens.length; i += 2) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, delayMs));
    yield tokens.slice(i, i + 2).join("");
  }
}
