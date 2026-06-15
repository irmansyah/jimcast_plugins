/**
 * jimcast-plugin-apps
 *
 * Searches macOS .app bundles and CLI tools from common bin directories.
 * Command-only plugin — shows results in the search list, no persistent widget.
 *
 * App behavior:
 * - .app bundles → `open -a "App Name"` (launches or focuses if already running)
 * - CLI binaries → opens in a new terminal via `open -a Terminal`
 */

import { definePlugin, createCommand, execSucceeded } from "@jimcast/sdk";
import type { ExecutionContext, CommandItem } from "@jimcast/sdk";
import { readdirSync, statSync } from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getUsername(): string {
  const home = process.env["HOME"] ?? "";
  return home.split("/").pop() ?? "user";
}

const USERNAME = getUsername();

const APP_DIRS = [
  "/Applications",
  "/System/Applications",
  `/Users/${USERNAME}/.nix-profile/Applications`,
  `/nix/var/nix/profiles/default/Applications`,
];

const BIN_DIRS = [
  `/Users/${USERNAME}/.nix-profile/bin`,
  "/run/current-system/sw/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppEntry {
  name: string;
  path: string;
  type: "app" | "cli";
}

// ---------------------------------------------------------------------------
// Cache — populated at module load, before user triggers anything
// ---------------------------------------------------------------------------

let cachedEntries: AppEntry[] | null = null;

function warmCache(): void {
  if (cachedEntries) return;

  const entries: AppEntry[] = [];
  const seen = new Set<string>();

  // Scan .app bundles
  for (const dir of APP_DIRS) {
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".app")) continue;
        const name = file.replace(/\.app$/, "");
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ name, path: `${dir}/${file}`, type: "app" });
        }
      }
    } catch {
      // dir doesn't exist or not readable — skip
    }
  }

  // Scan CLI binaries
  for (const dir of BIN_DIRS) {
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const key = file.toLowerCase();
        if (seen.has(key)) continue;
        try {
          const stat = statSync(`${dir}/${file}`);
          if (!stat.isFile()) continue;
          seen.add(key);
          entries.push({ name: file, path: `${dir}/${file}`, type: "cli" });
        } catch {
          // broken symlink or permission error — skip
        }
      }
    } catch {
      // dir doesn't exist or not readable — skip
    }
  }

  cachedEntries = entries;
}

// Kick off immediately at module load — by the time the user types, it's done
warmCache();

function getAllEntries(): AppEntry[] {
  if (!cachedEntries) warmCache(); // fallback if somehow not ready
  return cachedEntries!;
}

// ---------------------------------------------------------------------------
// Command items
// ---------------------------------------------------------------------------

function appToItem(app: AppEntry, context: ExecutionContext): CommandItem {
  if (app.type === "app") {
    return {
      id: `app-${app.name}`,
      title: app.name,
      subtitle: app.path,
      accessory: "app",
      keywords: [app.name.toLowerCase()],
      actions: [
        {
          id: "launch",
          title: "Launch / Focus",
          shortcut: "cmd+return",
          async onAction() {
            // Try by name first; fall back to path for Nix apps not in /Applications
            const r = await context.exec(`open -a ${JSON.stringify(app.name)} 2>/dev/null || open ${JSON.stringify(app.path)}`);
            if (!execSucceeded(r)) {
              await context.showToast(`Failed to open ${app.name}`, {
                style: "failure",
                message: r.stderr.trim(),
              });
            }
          },
        },
        {
          id: "copy-path",
          title: "Copy Path",
          shortcut: "cmd+c",
          async onAction() {
            await context.copyToClipboard(app.path);
            await context.showToast("Path copied", { style: "success", duration: 1500 });
          },
        },
      ],
    };
  }

  // CLI tool
  return {
    id: `cli-${app.name}`,
    title: app.name,
    subtitle: app.path,
    accessory: "cli",
    keywords: [app.name.toLowerCase(), "terminal", "cli", "bin"],
    actions: [
      {
        id: "open-in-terminal",
        title: "Open in Terminal",
        shortcut: "cmd+return",
        async onAction() {
          const script = `osascript -e 'tell application "Terminal" to do script "${app.name}"'`;
          const r = await context.exec(script);
          if (!execSucceeded(r)) {
            await context.showToast(`Failed to open ${app.name}`, {
              style: "failure",
              message: r.stderr.trim(),
            });
          }
        },
      },
      {
        id: "copy-path",
        title: "Copy Path",
        shortcut: "cmd+c",
        async onAction() {
          await context.copyToClipboard(app.path);
          await context.showToast("Path copied", { style: "success", duration: 1500 });
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const searchAppsCommand = createCommand({
  id: "apps.search",
  title: "Search Apps & Tools",
  subtitle: "Launch apps or open CLI tools in Terminal",
  keywords: ["app", "launch", "open", "run", "tool", "bin", "cli", "finder"],

  async execute(context) {
    const all = getAllEntries(); // instant — cache is already warm

    const sorted = [...all].sort((a, b) => {
      if (a.type !== b.type) return a.type === "app" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Return all — SDK handles per-keystroke fuzzy filtering via title + keywords
    return sorted.map(entry => appToItem(entry, context));
  },
});

export default definePlugin({
  name: "App Search",
  description: "Search and launch macOS apps and CLI tools",
  commands: [searchAppsCommand],
});
