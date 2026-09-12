/** TRACK A — Xiao. Friend: do not edit. */

export function buzz(pattern: number | number[] = [80, 40, 80]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* desktop */
  }
}
