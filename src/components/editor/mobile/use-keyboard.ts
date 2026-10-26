"use client";

import * as React from "react";

/**
 * Tracks the on-screen keyboard through the VisualViewport API — with math
 * that is INVARIANT to the two platform keyboard models:
 *
 *  - "resizes-content" (Android Chrome 108+; this app opts in via the
 *    `interactive-widget` meta): the LAYOUT viewport shrinks WITH the
 *    keyboard, so `innerHeight` and `vv.height` collapse in lockstep and
 *    `innerHeight − vv.height` is ≈ 0 even with the keyboard fully open.
 *    Any visibility check keyed on that difference can never fire — this
 *    was the root cause of the sticky toolbar never appearing on Android
 *    phones. Fixed elements need NO lift here (the layout already moved
 *    them above the keyboard).
 *  - "overlays content" (iOS Safari, older Android): `innerHeight` stays
 *    full while `vv.height` shrinks by the keyboard height — fixed
 *    elements must be lifted by exactly that amount, and `vv.offsetTop`
 *    must NOT be subtracted (it changes when the user scrolls within the
 *    visual viewport, which made the old result scroll-dependent).
 *
 * Visibility therefore compares `vv.height` against the tallest un-zoomed
 * viewport OBSERVED so far (`covered = fullVv − vv.height`) — one formula
 * that behaves identically on both models, is scroll-invariant, and is
 * immune to pinch-zoom. Updates are applied directly per viewport event
 * (rAF-coalesced, no CSS transition) so the toolbar stays *glued* to the
 * keyboard's top edge while it animates.
 */

export interface KeyboardState {
  /** Lift that `position: fixed` elements need (0 on resizes-content,
   * where the shrinking layout does the lifting natively). */
  keyboardHeight: number;
  /** Vertical footprint of the keyboard vs the keyboard-closed layout —
   * the height a sheet replacing the keyboard must freeze at. */
  keyboardSpace: number;
  /** How much the LAYOUT viewport itself shrank (resizes-content model;
   * 0 on overlay browsers). Used to keep overlays screen-anchored while
   * the layout re-expands during the keyboard⇄sheet swap. */
  layoutShrink: number;
  /** True when the keyboard is fully shown (above the noise threshold). */
  isKeyboardVisible: boolean;
}

/** Above the tallest browser-chrome collapse delta (~110px) on both
 * platforms, so URL-bar show/hide is never mistaken for a keyboard. */
const VISIBILITY_THRESHOLD = 110;
/** vv.scale tolerance around 1 — outside it the user is pinch-zooming. */
const ZOOM_NEUTRAL = 0.02;

declare global {
  interface Window {
    /** Dev-only: lets browser automation simulate the on-screen keyboard
     * (emulated browsers have no IME). Never set in production. */
    __mobileKbOverride?: number;
  }
}

const HIDDEN: KeyboardState = {
  keyboardHeight: 0,
  keyboardSpace: 0,
  layoutShrink: 0,
  isKeyboardVisible: false,
};

export function useKeyboard(): KeyboardState {
  const [state, setState] = React.useState<KeyboardState>(HIDDEN);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    let last = HIDDEN;

    // Tallest un-zoomed viewports observed = the keyboard-closed geometry.
    // They only ever GROW (browser chrome collapse, rotation to a taller
    // orientation); they reset on rotation / page restore below.
    let fullVv = vv.height;
    let fullInner = window.innerHeight;
    let pendingReset = false;

    const equal = (a: KeyboardState, b: KeyboardState) =>
      a.keyboardHeight === b.keyboardHeight &&
      a.keyboardSpace === b.keyboardSpace &&
      a.layoutShrink === b.layoutShrink &&
      a.isKeyboardVisible === b.isKeyboardVisible;

    const update = () => {
      if (pendingReset) {
        // Rotation / pageshow: geometry changed for reasons that are not a
        // keyboard — re-baseline instead of reading it as a huge keyboard.
        pendingReset = false;
        fullVv = vv.height;
        fullInner = window.innerHeight;
      }

      // Pinch-zoom shrinks vv.height without any keyboard — hold the last
      // known state until the gesture ends.
      if (Math.abs(vv.scale - 1) > ZOOM_NEUTRAL) return;

      if (vv.height > fullVv) fullVv = vv.height;
      if (window.innerHeight > fullInner) fullInner = window.innerHeight;

      // How much viewport the keyboard covers — scroll- and model-invariant.
      const covered = fullVv - vv.height;
      const isKeyboardVisible = covered > VISIBILITY_THRESHOLD;

      // How much the layout viewport itself shrank (resizes-content model).
      // Browser-chrome deltas (< threshold) are zeroed so they never leak
      // into overlay positioning.
      const rawShrink = fullInner - window.innerHeight;
      const layoutShrink = rawShrink > VISIBILITY_THRESHOLD ? rawShrink : 0;

      // Fixed-element lift. On the resizes-content model the shrinking
      // layout already lifted everything (innerHeight == vv.height) → 0.
      // On overlay browsers raise by the covered amount; the raw shrink
      // delta removes stale-baseline noise from browser-chrome states.
      const keyboardHeight = layoutShrink > 0
        ? 0
        : Math.max(0, Math.round(window.innerHeight - vv.height - rawShrink));

      const keyboardSpace = isKeyboardVisible
        ? Math.max(layoutShrink, keyboardHeight)
        : 0;

      let next: KeyboardState = {
        keyboardHeight,
        keyboardSpace,
        layoutShrink,
        isKeyboardVisible,
      };

      // Dev-only test hook: force a keyboard state (emulated browsers have
      // no IME). Simulates the overlay/lift model — production never set.
      if (
        process.env.NODE_ENV !== "production" &&
        typeof window.__mobileKbOverride === "number"
      ) {
        const kb = Math.max(0, Math.round(window.__mobileKbOverride));
        next = {
          keyboardHeight: kb,
          keyboardSpace: kb,
          layoutShrink: 0,
          isKeyboardVisible: kb > VISIBILITY_THRESHOLD,
        };
      }

      if (equal(last, next)) return;
      last = next;
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __mobileKbDebug?: KeyboardState }).__mobileKbDebug = next;
      }
      setState(next);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // Rotation and page restores change the viewport drastically without a
    // keyboard — re-baseline on the next viewport event instead.
    const onRebaseline = () => {
      pendingReset = true;
      schedule();
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", onRebaseline);
    window.addEventListener("pageshow", onRebaseline);
    update();

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", onRebaseline);
      window.removeEventListener("pageshow", onRebaseline);
    };
  }, []);

  return state;
}
