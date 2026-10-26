"use client";

import * as React from "react";

/**
 * Mobile capability detection — gates the native-app editing experience
 * (sticky keyboard toolbar, block-picker sheet, long-press block drag).
 *
 * `useIsMobile`  — coarse pointer OR narrow viewport: renders the mobile UI.
 * `useIsTouch`   — coarse pointer only: behaviors that must NEVER run on a
 *                  narrow desktop window (slash-menu suppression, nav-mode
 *                  text-selection lock) key off this instead.
 */

/** Dev-only override so automation can emulate a touch device. */
let devTouchOverride = false;
const TOUCH_CHANGE_EVENT = "aurora-touch-change";

function broadcastTouchChange() {
  window.dispatchEvent(new Event(TOUCH_CHANGE_EVENT));
}

function readTouchOverride(): boolean {
  return devTouchOverride;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(coarse.matches || narrow.matches || readTouchOverride());
    update();
    coarse.addEventListener("change", update);
    narrow.addEventListener("change", update);
    window.addEventListener(TOUCH_CHANGE_EVENT, update);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __setTouchMode?: (v: boolean) => void }).__setTouchMode = (v: boolean) => {
        devTouchOverride = v;
        broadcastTouchChange();
      };
    }
    return () => {
      coarse.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
      window.removeEventListener(TOUCH_CHANGE_EVENT, update);
      if (process.env.NODE_ENV !== "production") {
        delete (window as unknown as { __setTouchMode?: unknown }).__setTouchMode;
      }
    };
  }, []);

  return isMobile;
}

export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(coarse.matches || readTouchOverride());
    update();
    coarse.addEventListener("change", update);
    window.addEventListener(TOUCH_CHANGE_EVENT, update);
    return () => {
      coarse.removeEventListener("change", update);
      window.removeEventListener(TOUCH_CHANGE_EVENT, update);
    };
  }, []);

  return isTouch;
}

export interface VisualViewportState {
  /** Live keyboard overlay height (px) at the bottom of the layout viewport. */
  keyboardHeight: number;
  /** Keyboard considered open once the overlay passes the noise threshold. */
  keyboardVisible: boolean;
  /** Last measured keyboard height — the block-picker sheet sizing source. */
  lastKeyboardHeight: number;
  /** True while the keyboard height is actively changing (open/close animation). */
  animating: boolean;
}

const KEYBOARD_THRESHOLD = 120;

/**
 * Tracks the on-screen keyboard through the VisualViewport API.
 *
 * The layout viewport keeps its height while the keyboard is open (the
 * default `resizes-visual` behavior), so the overlay height is:
 *
 *     window.innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * Fixed-position UI then rides the keyboard's top edge by offsetting its
 * `bottom` by exactly this value — zero layout reflow, zero jumping, and
 * during the keyboard's open/close animation the edge is tracked frame by
 * frame for a native "attached" feel.
 */
export function useVisualViewport(): VisualViewportState {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [lastKeyboardHeight, setLastKeyboardHeight] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);

  React.useEffect(() => {
    const vv = window.visualViewport;
    const fake = { px: null as number | null };
    let raf = 0;
    let settleTimer = 0;

    const compute = () => {
      if (!vv) return 0;
      // Pinch-zoom also shrinks the visual viewport — that's not a keyboard.
      if (vv.scale > 1.01) return 0;
      const overlay = window.innerHeight - vv.height - vv.offsetTop;
      return Math.max(0, Math.round(overlay));
    };

    const apply = () => {
      const overlay = fake.px != null ? fake.px : compute();
      setKeyboardHeight((prev) => (prev === overlay ? prev : overlay));
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    // Mark "animating" while the height keeps changing so consumers can
    // follow the keyboard edge directly instead of easing toward it.
    const markAnimating = () => {
      setAnimating(true);
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => setAnimating(false), 220);
    };

    const onResize = () => {
      markAnimating();
      schedule();
    };
    const onScroll = () => schedule();

    if (vv) {
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", onScroll);
    }
    schedule();

    // Dev/testing handle — drives keyboard state where no virtual keyboard
    // exists (headless browsers, desktop preview).
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __setFakeKeyboard?: (px: number | null) => void };
      w.__setFakeKeyboard = (px: number | null) => {
        fake.px = px;
        markAnimating();
        schedule();
      };
    }

    return () => {
      if (vv) {
        vv.removeEventListener("resize", onResize);
        vv.removeEventListener("scroll", onScroll);
      }
      if (raf) cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
      if (process.env.NODE_ENV !== "production") {
        delete (window as unknown as { __setFakeKeyboard?: unknown }).__setFakeKeyboard;
      }
    };
  }, []);

  // Remember the last real keyboard height — the sheet replaces the
  // keyboard at exactly this size, so the swap has zero displacement.
  React.useEffect(() => {
    if (keyboardHeight > KEYBOARD_THRESHOLD) {
      setLastKeyboardHeight((prev) => (prev === keyboardHeight ? prev : keyboardHeight));
    }
  }, [keyboardHeight]);

  return {
    keyboardHeight,
    keyboardVisible: keyboardHeight > KEYBOARD_THRESHOLD,
    lastKeyboardHeight,
    animating,
  };
}
