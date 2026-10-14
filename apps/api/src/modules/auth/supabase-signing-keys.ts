import type { JSONWebKey } from 'jwks-rsa';

/**
 * Supabase's token-signing keys, fetched once per Lambda instance while it
 * boots (in parallel with the rest of start-up) instead of on its first
 * authenticated request.
 *
 * jwks-rsa still verifies every token. These keys are only handed to it via
 * its getKeysInterceptor hook; if a token uses a key id that isn't here
 * (e.g. Supabase rotated its keys) jwks-rsa falls back to fetching the JWKS
 * endpoint itself. Keys are re-fetched after the same 10 minutes that
 * jwks-rsa caches them for by default, so revocation behaves as before.
 */
const REFRESH_AFTER_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3_000;

let cached:
  { uri: string; fetchedAt: number; keys: Promise<JSONWebKey[]> } | undefined;

export function supabaseJwksUri(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
}

async function fetchKeys(uri: string): Promise<JSONWebKey[]> {
  try {
    const response = await fetch(uri, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { keys?: unknown };
    return Array.isArray(body.keys) ? (body.keys as JSONWebKey[]) : [];
  } catch {
    // Never fail start-up over this: jwks-rsa will fetch the keys itself.
    return [];
  }
}

/** Starts (or reuses) the fetch. Safe to call without awaiting. */
export function prefetchSupabaseSigningKeys(
  uri: string,
): Promise<JSONWebKey[]> {
  const now = Date.now();
  if (
    !cached ||
    cached.uri !== uri ||
    now - cached.fetchedAt > REFRESH_AFTER_MS
  ) {
    cached = { uri, fetchedAt: now, keys: fetchKeys(uri) };
  }
  return cached.keys;
}

/** For tests. */
export function resetSupabaseSigningKeys(): void {
  cached = undefined;
}
