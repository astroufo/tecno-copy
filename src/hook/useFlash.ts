import { useEffect, useRef, useState } from "react";

/**
 * Returns a CSS class that briefly "flashes" whenever `value` changes.
 * - value goes up   -> "flash-up"
 * - value goes down -> "flash-down"
 * The class auto-clears after `duration` ms so it can re-trigger next change.
 */
export function useFlash(value: number, duration = 700): string {
  const prev = useRef(value);
  const [cls, setCls] = useState("");

  useEffect(() => {
    if (value === prev.current || Number.isNaN(value)) return;

    const up = value > prev.current;
    prev.current = value;
    setCls(up ? "flash-up" : "flash-down");

    const id = window.setTimeout(() => setCls(""), duration);
    return () => window.clearTimeout(id);
  }, [value, duration]);

  return cls;
}

export default useFlash;
