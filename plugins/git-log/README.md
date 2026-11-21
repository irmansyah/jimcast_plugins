# Git log

Inline, read-only "terminal print" of a repo: `git status -sb` and
`git log --graph --oneline --decorate`, drawn directly in the slot. Enter / click on a commit
copies its hash (`pbcopy`, macOS).

Which repo:

1. the Finder's selection: the folder itself, or the folder holding the selected file, resolved to
   its git root;
2. otherwise the git-branches plugin's active repo (else its first tracked one).

The header shows which was used ("from Finder" / "from Git widget").

## Install

```bash
jimcast plugin install git-log
# or by package id:
jimcast plugin install com.jimcast.plugins.git-log
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `git-log` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "git-log": { "use": "com.jimcast.plugins.git-log" } }
```

The alias only declares the widget. To show it, place `git-log` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh git-log
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Reads other widgets' state

This plugin only reads two locations, both declared at the top of `src/index.ts`:

- `FINDER_PATH_FILE` = `~/.jimcast/finder-path` (the built-in Finder's selection)
- `GIT_BRANCHES_DIR` = `~/.jimcast/plugin-data/com.jimcast.plugins.git-branches` (files `repo`, `repos`)

If the Finder is later ported to a plugin, or the git-branches plugin id changes, update them.

## Differences from the built-in

- All code lives in one file, `src/index.ts`.
- Git widget state is read from the git-branches plugin's data dir (it moved from `~/.jimcast/git`).
- `shellExec` options (`ignore_exit_code`, `trim_output`, `timeout_secs`) are dropped; output is trimmed in code.
- The copy action is a closure with the hash pre-quoted by `shq()` instead of `{p}` interpolation.
- Item ids use the prefix `extgl` instead of `gl`.
- `theme.*` is replaced by `ctx.host.theme.colors` with fallbacks and local font constants.
- No CLI commands or key actions (the built-in had none), so only the `shell` capability is declared.
