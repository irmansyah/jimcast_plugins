// [plugin] jim-colorpicker/src/palettes.ts
//
// Built-in color schemes, the generated spectrum and palette lookup.
// Spec format: "name #hex, name #hex, ..." (underscores in names become
// spaces). Add a scheme by adding one line to COLOR_SCHEMES.

import { SPECTRUM_ID } from "./shell.js";

export interface PaletteColor { name?: string; hex: string }
interface ColorPalette { id: string; name: string; colors: PaletteColor[] }

const scheme = (id: string, name: string, spec: string): ColorPalette => ({
  id: `scheme:${id}`,
  name,
  colors: spec.split(",").map((e) => e.trim()).filter(Boolean).map((e) => {
    const [n, hex] = e.split(/\s+/);
    return { name: n.replace(/_/g, " "), hex: hex.toLowerCase() };
  }),
});

export const COLOR_SCHEMES: readonly ColorPalette[] = [
  scheme("gruvbox-dark", "Gruvbox Dark", `
    bg0_h #1d2021, bg0 #282828, bg1 #3c3836, bg2 #504945, bg3 #665c54, bg4 #7c6f64,
    gray #928374, fg4 #a89984, fg3 #bdae93, fg2 #d5c4a1, fg1 #ebdbb2, fg0 #fbf1c7,
    red #fb4934, green #b8bb26, yellow #fabd2f, blue #83a598, purple #d3869b, aqua #8ec07c, orange #fe8019,
    red_neutral #cc241d, green_neutral #98971a, yellow_neutral #d79921, blue_neutral #458588,
    purple_neutral #b16286, aqua_neutral #689d6a, orange_neutral #d65d0e`),
  scheme("gruvbox-light", "Gruvbox Light", `
    bg0_h #f9f5d7, bg0 #fbf1c7, bg1 #ebdbb2, bg2 #d5c4a1, bg3 #bdae93, bg4 #a89984,
    gray #928374, fg4 #7c6f64, fg3 #665c54, fg2 #504945, fg1 #3c3836, fg0 #282828,
    red #9d0006, green #79740e, yellow #b57614, blue #076678, purple #8f3f71, aqua #427b58, orange #af3a03,
    red_neutral #cc241d, green_neutral #98971a, yellow_neutral #d79921, blue_neutral #458588,
    purple_neutral #b16286, aqua_neutral #689d6a, orange_neutral #d65d0e`),
  scheme("nord", "Nord", `
    nord0 #2e3440, nord1 #3b4252, nord2 #434c5e, nord3 #4c566a,
    nord4 #d8dee9, nord5 #e5e9f0, nord6 #eceff4,
    frost1 #8fbcbb, frost2 #88c0d0, frost3 #81a1c1, frost4 #5e81ac,
    red #bf616a, orange #d08770, yellow #ebcb8b, green #a3be8c, purple #b48ead`),
  scheme("catppuccin-mocha", "Catppuccin Mocha", `
    rosewater #f5e0dc, flamingo #f2cdcd, pink #f5c2e7, mauve #cba6f7, red #f38ba8, maroon #eba0ac,
    peach #fab387, yellow #f9e2af, green #a6e3a1, teal #94e2d5, sky #89dceb, sapphire #74c7ec,
    blue #89b4fa, lavender #b4befe,
    text #cdd6f4, subtext1 #bac2de, subtext0 #a6adc8, overlay2 #9399b2, overlay1 #7f849c, overlay0 #6c7086,
    surface2 #585b70, surface1 #45475a, surface0 #313244, base #1e1e2e, mantle #181825, crust #11111b`),
  scheme("catppuccin-latte", "Catppuccin Latte", `
    rosewater #dc8a78, flamingo #dd7878, pink #ea76cb, mauve #8839ef, red #d20f39, maroon #e64553,
    peach #fe640b, yellow #df8e1d, green #40a02b, teal #179299, sky #04a5e5, sapphire #209fb5,
    blue #1e66f5, lavender #7287fd,
    text #4c4f69, subtext1 #5c5f77, subtext0 #6c6f85, overlay2 #7c7f93, overlay1 #8c8fa1, overlay0 #9ca0b0,
    surface2 #acb0be, surface1 #bcc0cc, surface0 #ccd0da, base #eff1f5, mantle #e6e9ef, crust #dce0e8`),
  scheme("dracula", "Dracula", `
    background #282a36, current_line #44475a, foreground #f8f8f2, comment #6272a4,
    cyan #8be9fd, green #50fa7b, orange #ffb86c, pink #ff79c6, purple #bd93f9, red #ff5555, yellow #f1fa8c`),
  scheme("solarized", "Solarized", `
    base03 #002b36, base02 #073642, base01 #586e75, base00 #657b83,
    base0 #839496, base1 #93a1a1, base2 #eee8d5, base3 #fdf6e3,
    yellow #b58900, orange #cb4b16, red #dc322f, magenta #d33682,
    violet #6c71c4, blue #268bd2, cyan #2aa198, green #859900`),
  scheme("tokyo-night", "Tokyo Night", `
    bg_dark #16161e, bg #1a1b26, bg_storm #24283b, bg_highlight #292e42, terminal_black #414868,
    comment #565f89, fg_dark #a9b1d6, fg #c0caf5,
    red #f7768e, orange #ff9e64, yellow #e0af68, green #9ece6a, teal #73daca,
    cyan #7dcfff, blue #7aa2f7, purple #bb9af7`),
  scheme("one-dark", "One Dark", `
    bg_alt #21252b, bg #282c34, gray #5c6370, fg #abb2bf,
    red #e06c75, orange #d19a66, yellow #e5c07b, green #98c379, cyan #56b6c2, blue #61afef, magenta #c678dd`),
];

// ── Spectrum ────────────────────────────────────────────────────────────────
export const SPECTRUM_COLUMNS = 60;
export const SCHEME_COLUMNS = 14; // schemes and profiles: fewer, bigger tiles
const LIGHTNESS = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28, 0.2];
const SATURATION = 0.85;

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function spectrumColors(): PaletteColor[] {
  const hexes: string[] = [];
  for (const l of LIGHTNESS)
    for (let c = 0; c < SPECTRUM_COLUMNS; c++) hexes.push(hslToHex((c * 360) / SPECTRUM_COLUMNS, SATURATION, l));
  for (let c = 0; c < SPECTRUM_COLUMNS; c++) hexes.push(hslToHex(0, 0, c / (SPECTRUM_COLUMNS - 1)));
  return hexes.map((hex) => ({ hex }));
}

// ── Palette list ────────────────────────────────────────────────────────────
export interface PaletteRef { id: string; name: string }

export const paletteList = (profiles: string[]): PaletteRef[] => [
  { id: SPECTRUM_ID, name: "Spectrum" },
  ...COLOR_SCHEMES.map((p) => ({ id: p.id, name: p.name })),
  ...profiles.map((n) => ({ id: `profile:${n}`, name: `★ ${n}` })),
];

export function findPalette(q: string, profiles: string[]): PaletteRef | undefined {
  const all = paletteList(profiles), s = q.toLowerCase();
  return all.find((p) => p.id.toLowerCase() === s)
    ?? all.find((p) => p.name.toLowerCase().replace(/^★ /, "") === s)
    ?? all.find((p) => p.id.toLowerCase().endsWith(`:${s}`));
}
