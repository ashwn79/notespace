/**
 * Touch-device detection.
 *
 * The mobile interaction model (sticky toolbar, block picker, long-press
 * drag) is gated on a *coarse pointer with no hover* — the standard signal
 * for phones and tablets. Desktop touch-screen laptops still report a
 * fine pointer + hover, so they keep the desktop UX.
 */

export const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

/** Fired (dev-only) when the touch override flag flips. */
export const TOUCH_OVERRIDE_EVENT = "aurora:touch-override";

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(TOUCH_QUERY).matches;
}

/** One-shot check safe to call inside event handlers / extension plugins. */
export function isTouchLike(): boolean {
  // Dev-only test hook — browser automation cannot emulate coarse-pointer
  // media features, so tests force the mobile interaction model explicitly.
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window as { __mobileTouchOverride?: boolean }).__mobileTouchOverride === true
  ) {
    return true;
  }
  if (isCoarsePointer()) return true;
  // Fallback: an explicitly small screen with touch support.
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window &&
    Math.min(window.innerWidth, window.innerHeight) < 820
  );
}
