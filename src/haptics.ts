/** Vega's only other channel. Sound is off the table for her. */
export function buzz(pattern: number | number[] = [90, 60, 90]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* desktop, or a browser that refuses */
  }
}
