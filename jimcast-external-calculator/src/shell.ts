// [plugin] jimcast-external-calculator/src/shell.ts
import type { ExecutionContext } from "@jimcast/sdk";

export type Exec = Pick<ExecutionContext, "exec">;

export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// TODO: replace with the SDK clipboard call once it exists (core used port.copyToClipboard).
// Shell fallback: first available of pbcopy (macOS), wl-copy (Wayland), xclip, xsel.
export const copyCmd = (raw: string) =>
  `printf %s ${shq(raw)} | { ` +
  `if command -v pbcopy >/dev/null 2>&1; then pbcopy; ` +
  `elif command -v wl-copy >/dev/null 2>&1; then wl-copy; ` +
  `elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard; ` +
  `elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --input; ` +
  `else exit 1; fi; }`;
