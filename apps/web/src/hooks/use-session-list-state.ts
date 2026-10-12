import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const STORAGE_PREFIX = "flow-session-list:v1:";
const RESET_EVENT = "flow-session-list-reset";

export function sessionListStateKey(
  userId: string,
  workspaceId: string,
  preferenceKey: string,
) {
  return `${STORAGE_PREFIX}${JSON.stringify([
    userId,
    workspaceId,
    preferenceKey,
  ])}`;
}

export function clearSessionListState() {
  if (typeof window === "undefined") return;

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Reset mounted controls even when browser storage is unavailable.
  }

  window.dispatchEvent(new Event(RESET_EVENT));
}

function isStorablePrimitive(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function readValue<T>(key: string | null, fallback: T): T {
  if (!key || typeof window === "undefined") return fallback;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;

    const stored = JSON.parse(raw);

    if (!stored || typeof stored !== "object") return fallback;

    if (fallback instanceof Set) {
      if (
        stored.kind !== "set" ||
        !Array.isArray(stored.value) ||
        !stored.value.every((item: unknown) => typeof item === "string")
      ) {
        return fallback;
      }

      return new Set(stored.value) as T;
    }

    if (stored.kind !== "value") return fallback;
    if (!Object.prototype.hasOwnProperty.call(stored, "value")) {
      return fallback;
    }

    // Fallbacks for union types (e.g. `number | "all"`) have a runtime type
    // that is only one branch of the union, so comparing `typeof stored.value`
    // against `typeof fallback` rejects the other, equally valid branches
    // (storing "all" then reloading would get typeof "string" !== typeof
    // 20 === "number" and silently discard it). Accept any JSON-safe
    // primitive here; this still rejects corrupted/mismatched shapes such as
    // an object or array sneaking into a scalar field.
    if (fallback !== null && !isStorablePrimitive(stored.value)) {
      return fallback;
    }

    return stored.value as T;
  } catch {
    return fallback;
  }
}

function writeValue<T>(key: string, value: T) {
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify(
        value instanceof Set
          ? { kind: "set", value: [...value] }
          : { kind: "value", value },
      ),
    );
  } catch {
    // Controls remain usable when storage is blocked or full.
  }
}

interface Snapshot<T> {
  key: string | null;
  value: T;
}

export function useSessionListState<T>(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  preferenceKey: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const defaults = useRef<{ value: T } | null>(null);

  if (!defaults.current) {
    defaults.current = {
      value:
        typeof initialValue === "function"
          ? (initialValue as () => T)()
          : initialValue,
    };
  }

  const fallback = defaults.current.value;
  const key =
    userId && workspaceId
      ? sessionListStateKey(userId, workspaceId, preferenceKey)
      : null;

  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => ({
    key,
    value: readValue(key, fallback),
  }));

  let current = snapshot;

  // Switch scope before returning values to the consuming component.
  if (snapshot.key !== key) {
    current = { key, value: readValue(key, fallback) };
    setSnapshot(current);
  }

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setSnapshot((previous) => {
        const previousValue =
          previous.key === key ? previous.value : readValue(key, fallback);

        const nextValue =
          typeof action === "function"
            ? (action as (value: T) => T)(previousValue)
            : action;

        return { key, value: nextValue };
      });
    },
    [key, fallback],
  );

  useEffect(() => {
    if (!key || snapshot.key !== key) return;
    writeValue(key, snapshot.value);
  }, [key, snapshot]);

  useEffect(() => {
    const reset = () => {
      setSnapshot({ key, value: fallback });
    };

    window.addEventListener(RESET_EVENT, reset);
    return () => window.removeEventListener(RESET_EVENT, reset);
  }, [key, fallback]);

  return [current.value, setValue];
}
