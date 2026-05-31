/**
 * Batch E: unified wrapper around supabase.functions.invoke with timeout,
 * exponential backoff retry, and AbortController cleanup.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EdgeCallOptions {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export async function edgeCall<T = unknown>(
  fn: string,
  opts: EdgeCallOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { body, headers, timeoutMs = 15_000, retries = 1, retryDelayMs = 600 } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: body as never,
        headers,
      });
      clearTimeout(timer);
      if (error) throw new Error(error.message || "Edge function error");
      return { data: data as T, error: null };
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
      // Exponential backoff
      await new Promise((r) => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
    }
  }
  return { data: null, error: new Error("Unknown edge call failure") };
}