import type { MutableRefObject } from "react";
import type { SavedRequest } from "../types";

export function newId(counterRef: MutableRefObject<number>): string {
  counterRef.current += 1;
  return `req-${Date.now()}-${counterRef.current}`;
}

export function resolveTarget(
  requests: SavedRequest[],
  selectedRequest: SavedRequest | null,
  arg: string,
): SavedRequest | null {
  if (!arg) return selectedRequest;
  const n = Number(arg);
  if (!Number.isNaN(n) && n >= 1 && n <= requests.length) return requests[n - 1];
  const lower = arg.toLowerCase();
  return (
    requests.find((r) => r.name.toLowerCase().includes(lower)) ||
    requests.find((r) => r.url.toLowerCase().includes(lower)) ||
    null
  );
}
