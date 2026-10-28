import type { CSSProperties } from "react";

/**
 * Shared positioning for caret-anchored menus (slash, @, emoji).
 * Clamps horizontally, flips above the caret when there is no room below,
 * and collapses to a bottom sheet on narrow screens.
 */
export function anchoredMenuStyle(
  rect: DOMRect | null,
  options: { width: number; height: number; gap?: number },
): CSSProperties {
  const { width, height, gap = 8 } = options;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (isMobile) {
    return { left: 0, right: 0, bottom: 0, top: "auto", maxWidth: "100%" };
  }
  if (!rect) {
    return { left: "50%", top: "30%", transform: "translate(-50%, 0)" };
  }

  const flip = rect.bottom + height + gap + 12 > window.innerHeight;
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  if (flip) {
    return { left, bottom: window.innerHeight - rect.top + gap, top: "auto" };
  }
  return { left, top: rect.bottom + gap };
}

/**
 * Positioning for anchor-triggered popovers (mention pills, cards).
 * Same flip + clamp rules as `anchoredMenuStyle`, but never goes
 * bottom-sheet (popovers are small and must stay near their anchor).
 * Also returns a `maxHeight` so tall popovers scroll internally instead
 * of spilling past the viewport edge.
 */
export function anchoredPopoverStyle(
  rect: DOMRect | null,
  options: { width: number; height: number; gap?: number },
): CSSProperties {
  const { width, height, gap = 8 } = options;
  if (!rect) {
    return { left: "50%", top: "30%", transform: "translate(-50%, 0)" };
  }
  const roomBelow = window.innerHeight - rect.bottom - gap - 10;
  const roomAbove = rect.top - gap - 10;
  const flip = roomBelow < Math.min(height, 220) && roomAbove > Math.min(roomBelow, 200);
  const left = Math.min(Math.max(10, rect.left), window.innerWidth - width - 10);
  if (flip) {
    return {
      left,
      bottom: window.innerHeight - rect.top + gap,
      top: "auto",
      maxHeight: Math.max(160, roomAbove),
    };
  }
  return { left, top: rect.bottom + gap, maxHeight: Math.max(160, roomBelow) };
}
