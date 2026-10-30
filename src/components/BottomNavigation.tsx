import { useEffect, useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        const editing =
          focused instanceof HTMLElement &&
          (focused.matches(
            'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea',
          ) ||
            focused.isContentEditable);
        setOpen(
          Boolean(
            editing &&
            viewport.scale === 1 &&
            window.innerHeight - viewport.height > 150,
          ),
        );
      });
    };
    update();
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return open;
}

export default function BottomNavigation({
  items,
  inactive,
  onPrefetch,
}: {
  items: { to: string; label: string; short?: string; icon: LucideIcon }[];
  inactive: boolean;
  onPrefetch: (path: string) => void;
}) {
  const { pathname } = useLocation();
  const keyboardOpen = useKeyboardOpen();
  const index = items.findIndex((item) =>
    item.to === "/"
      ? pathname === "/"
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  return (
    <nav
      className={`bottom-nav${keyboardOpen ? " keyboard-open" : ""}`}
      aria-label="Navegación inferior"
      inert={inactive || keyboardOpen}
      aria-hidden={inactive || keyboardOpen || undefined}
    >
      <div
        className="bottom-nav-items"
        style={
          {
            "--nav-index": Math.max(0, index),
            "--nav-count": items.length,
          } as CSSProperties
        }
      >
        <span
          className={`bottom-nav-indicator${index < 0 ? " is-hidden" : ""}`}
          aria-hidden="true"
        />
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onPointerEnter={() => onPrefetch(item.to)}
            onPointerDown={() => onPrefetch(item.to)}
            onFocus={() => onPrefetch(item.to)}
          >
            <item.icon size={21} aria-hidden="true" />
            <span>{item.short ?? item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
