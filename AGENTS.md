# AGENTS.md

Monorepo of **jimcast plugins** (TypeScript, `@jimcast/sdk`). Read this first, then the skill.

## Skill (read before writing any plugin code)

`skills/jimcast-plugin/SKILL.md`  → rules, mental model, fast path.
References in `skills/jimcast-plugin/references/` (widget API, content types, shell patterns, CLI/keys, core quirks).

## Repo map

```
plugins/<name>/        real plugins (package name: jim-<name>)
  src/index.ts           createWidget + definePlugin + bootstrapPlugin
  src/render.ts          the view (WidgetContent tree)
  src/shell.ts           shell scripts + state reads (~/.jimcast/ext-<name>/)
  src/commands.ts        CLI commands (+ key actions)
examples/hello           1 file, 1 button
examples/counter         state file + buttons + CLI (same as templates/plugin)
templates/plugin         scaffold source, tokens __NAME__ / __SHORT__
scripts/                 new-plugin.sh, install.sh, install-all.sh, import-plugin.sh
docs/                    getting-started, architecture, plugin-catalog, core-changes
skills/jimcast-plugin/   the AI skill
```

## Commands

```bash
./scripts/link-skills.sh                # once, for Claude Code: .claude/skills -> ../skills
pnpm install                          # needs ../jimcast-sdk checked out next to this repo
pnpm typecheck                        # all plugins
pnpm build                            # all plugins -> plugins/*/dist/index.mjs
./scripts/new-plugin.sh <name>        # scaffold plugins/<name>
./scripts/install.sh <name|path>      # build + copy to ~/.jimcast/plugins/ (native or react, auto-detected)
./scripts/install.sh --all            # every plugin in plugins/   (flags: --no-build)
# env JIMCAST_PLUGINS_DIR overrides the destination; scripts/sync-plugin.sh is an alias
```

## Conventions

- One folder = one plugin. Keep plugins self-contained; no cross-plugin imports.
- Item ids start with `ext…`; CLI spec ids start with `x`. Never reuse core's names.
- State only in `~/.jimcast/ext-<name>/`. Shell values go through `shq()`.
- Colors from `ctx.host.theme.colors` with fallbacks.
- Every plugin README has: install, panel entry JSON, CLI examples.
- Adding a plugin = new folder + a row in `README.md` and `docs/plugin-catalog.md`.

## Do not

- Do not use browser APIs or React: widgets return data trees, not DOM.
- Do not keep state in memory between renders.
- Do not `rm` user files; move to Trash.
- Do not claim something works without running `pnpm typecheck`; say what is unverified.
