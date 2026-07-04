import { useEffect, useState } from "react";

/** Returns `value` delayed by `delayMs` — resets the timer on each change, so it
 * only settles once input pauses. Used to throttle type-ahead search requests. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
