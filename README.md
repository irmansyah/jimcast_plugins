# jimcast-plugins

**Extend your command bar in ~100 lines of TypeScript. Or ask your AI to do it.**

A monorepo of plugins for [jimcast](https://github.com/<your-org>/jimcast-core), the keyboard-first
launcher for macOS, plus a **skill** that teaches Claude Code, Cursor, Codex and friends how to write
new ones correctly on the first try.

| Plugin | What it does | Plugin id |
|---|---|---|
| [`pomodoro`](./plugins/jim-pomodoro) | Focus/break timer, progress bar, native notification | `com.jimcast.plugins.pomodoro` |
| [`calendar`](./plugins/jim-calendar) | Five-day strip + today's tasks | `com.jimcast.plugins.calendar` |
| [`colorpicker`](./plugins/jim-colorpicker) | Spectrum + Nord/Gruvbox/Catppuccin/… palettes, saved profiles, click to copy hex | `com.jimcast.plugins.colorpicker` |
| [`emojipicker`](./plugins/jim-emojipicker) | Tabs, recents, click to copy | `com.jimcast.plugins.emojipicker` |
| [`aiagents`](./plugins/jim-aiagents) | AI agents feed with tabs | `com.jimcast.plugins.aiagents` |
| [`finder`](./plugins/jim-finder) | Keyboard file browser: marks, copy/cut/paste, zip, trash | `com.jimcast.plugins.finder` |
| [`restapi`](./plugins/jim-restapi) | Run REST requests from JSON configs | `com.jimcast.plugins.restapi` |
| [`examples/hello`](./examples/hello) | One file, one button | `com.jimcast.examples.hello` |
| [`examples/counter`](./examples/counter) | State file + buttons + CLI | `com.jimcast.examples.counter` |

<!-- TODO: add a GIF per plugin: docs/media/pomodoro.gif etc. -->

## Install in 30 seconds

```bash
git clone https://github.com/<your-org>/jimcast-sdk.git       # sibling checkout, until the SDK is on npm
git clone https://github.com/<your-org>/jimcast-plugins.git
cd jimcast-plugins
chmod +x scripts/*.sh                  # only needed if your unzip dropped the exec bits
pnpm install
./scripts/install.sh jim-pomodoro      # or: ./scripts/install.sh --all
```

Fully quit and relaunch jimcast-core, then give the plugin an alias in `config.json`:

```json
"widgets": {
  "pomodoro": { "use": "com.jimcast.plugins.pomodoro" }
}
```

and add it as a panel in `config_section.json`:

```json
{ "id": "pomodoro", "label": "Pomodoro", "kind": "external-component" }
```

Drive it from the terminal with the alias:

```bash
jimcast widget command pomodoro toggle
jimcast widget command calendar add "ship it"
```

## Write your own with AI

This repo ships a skill at [`skills/jimcast-plugin`](skills/jimcast-plugin/SKILL.md).

```bash
./scripts/link-skills.sh      # once: lets Claude Code find the skill (.claude/skills -> ../skills)
```

Other agents (Cursor, Codex, Copilot…): point them at [`AGENTS.md`](AGENTS.md) or [`llms.txt`](llms.txt). Then ask:

> Make a jimcast plugin called `docker` that lists running containers, with a button to stop each one
> and a CLI `docker stop <name>`.

The skill gives the agent the mental model, the sharp edges we already hit, and real plugins to copy.

## Write your own by hand

```bash
./scripts/new-plugin.sh my-timer     # scaffolds a folder under plugins/
./scripts/install.sh <new folder>
```

Set the `package.json` `name` to a reverse-DNS id (`com.jimcast.plugins.my-timer`). You never write ids in code.

The smallest possible plugin ([`examples/hello`](examples/hello/src/index.ts)):

```ts
import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";

export const hello = createWidget({
  section: { title: "Hello" },
  showIn: ["default"],
  render: async (ctx) => ({
    type: "list",
    datas: [{
      id: "hello-say", pinned: true,
      attribute: { label1: "Say hello 👋" },
      action: { run: async () => { await ctx.exec(`osascript -e 'display notification "Hi" with title "jimcast"'`); }, then: "dismiss" },
    }],
  }),
});

const plugin = definePlugin({ description: "Hello", commands: [], widgets: [hello] });
export default plugin;
bootstrapPlugin(plugin);
```

## How it works

```
 jimcast-core ──render_widget──▶ your plugin (Node) ──▶ returns a data tree (list / grid / progress …)
      ▲                                   │
      └── click / Enter ── action id ─────┘  runs your shell script, then re-renders
```

- **Widgets are data, not HTML.** No framework, no DOM, native look and keyboard navigation for free.
- **One id.** The plugin id (`package.json` `name`) is the id of the main widget, the CLI and the keys. Extra widgets are `<plugin id>.<local id>`.
- **Stateless.** State lives in plain files under `~/.jimcast/plugin-data/<plugin id>/`, built only with `pluginDataDir()` / `pluginDataFile(name)` from the SDK, so it is inspectable and scriptable.
- **Every widget gets a CLI.** `jimcast widget command <alias> …` drives the same actions as a click.

More: [docs/getting-started.md](docs/getting-started.md), [docs/architecture.md](docs/architecture.md), [docs/plugin-catalog.md](docs/plugin-catalog.md).

## Plugin ideas (good first PRs)

clipboard history · weather · docker containers · git branches · now-playing + media keys · port killer ·
kubectl contexts · world clock · unit/currency converter · password-store picker · Homebrew updates · GitHub notifications

## Status

`repeat` (auto-refresh, used by `pomodoro`, `aiagents` and `calendar`) needs a small core change: see
[docs/core-changes.md](docs/core-changes.md). `pnpm typecheck` is the source of truth.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New plugin = one folder under `plugins/`, one row in this table.

MIT
