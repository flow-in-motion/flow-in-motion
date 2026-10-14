import type { users } from '@research-tracker/migrations';

type UserRow = typeof users.$inferSelect;

/**
 * Short-lived, per-instance cache of "signed-in user" lookups.
 *
 * A single API request used to look the caller up by their auth id two to
 * four times (access guards, the request-context interceptor, then the
 * controller). The id never changes, and the other fields are refreshed
 * at most TTL_MS later, or immediately when this instance writes the user.
 * Misses are never cached, so a newly provisioned user is found at once.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

const entries = new Map<string, { user: UserRow; expiresAt: number }>();

export const userLookupCache = {
  get(externalAuthId: string): UserRow | undefined {
    const entry = entries.get(externalAuthId);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      entries.delete(externalAuthId);
      return undefined;
    }
    return entry.user;
  },

  set(externalAuthId: string, user: UserRow): void {
    if (entries.size >= MAX_ENTRIES && !entries.has(externalAuthId)) {
      // Maps keep insertion order, so the first key is the oldest entry.
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(externalAuthId, { user, expiresAt: Date.now() + TTL_MS });
  },

  /** Drop any cached entry for this user (after an update or deletion). */
  forget(match: { id?: string; externalAuthId?: string | null }): void {
    if (match.externalAuthId) entries.delete(match.externalAuthId);
    if (match.id) {
      for (const [key, entry] of entries) {
        if (entry.user.id === match.id) entries.delete(key);
      }
    }
  },

  clear(): void {
    entries.clear();
  },
};
