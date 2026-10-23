import { useEffect } from "react";

/** Fixed positioning also prevents background scrolling in standalone iOS Safari. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: "0",
      right: "0",
      width: "100%",
      overflow: "hidden",
    });

    return () => {
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
