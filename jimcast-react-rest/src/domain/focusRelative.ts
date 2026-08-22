import type { RefObject } from "react";

type Focusable = HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Moves focus to the next/previous focusable field within a container —
 * used by both the editor and response panels for j/k / arrow-key field
 * navigation.
 */
export function focusRelative(containerRef: RefObject<HTMLElement>, delta: number): void {
  if (!containerRef.current) return;
  const nodes = Array.from(
    containerRef.current.querySelectorAll<Focusable>("input, select, textarea, button"),
  ).filter((el) => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
  if (nodes.length === 0) return;
  const idx = nodes.indexOf(document.activeElement as Focusable);
  let nextIdx: number;
  if (idx === -1) nextIdx = delta > 0 ? 0 : nodes.length - 1;
  else nextIdx = Math.max(0, Math.min(nodes.length - 1, idx + delta));
  nodes[nextIdx].focus();
}
