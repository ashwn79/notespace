"use client";

import * as React from "react";
import { isTouchLike, TOUCH_OVERRIDE_EVENT, TOUCH_QUERY } from "@/lib/editor/touch";

/**
 * Reactive touch detection. Defaults to `false` so SSR / first client
 * render matches the desktop markup; flips after mount for touch devices
 * (the mobile layer only renders after that, no hydration risk).
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    const update = () => setIsTouch(isTouchLike());
    update();
    const mq = window.matchMedia(TOUCH_QUERY);
    mq.addEventListener("change", update);
    // Dev-only override channel (browser automation).
    window.addEventListener(TOUCH_OVERRIDE_EVENT, update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener(TOUCH_OVERRIDE_EVENT, update);
    };
  }, []);

  return isTouch;
}
