# Git branches

Git repos as tabs (✓ clean / ●n changed, ↑ahead ↓behind) with the branch list of the active repo
below, newest commit first. Enter / click checks a branch out (a remote-only branch gets a
tracking branch). Controls: FETCH, PULL (ff-only), VIEW (local | remote), PRUNE merged.
Deletes are safe (`git branch -d`) and always ask first; force delete is a separate key.

## Install

```sh
./scripts/install.sh jim-git-branches
```

Add an alias to `~/.jimcast/config.json`:

```json
"widgets": { "git": { "use": "com.jimcast.plugins.git-branches" } }
```

## CLI

```sh
jimcast widget command git status [--json]
jimcast widget command git repos
jimcast widget command git add [path]
jimcast widget command git remove [name|number|path]
jimcast widget command git scan
jimcast widget command git use <name|number>
jimcast widget command git branches [--remote]
jimcast widget command git checkout <branch>
jimcast widget command git fetch
jimcast widget command git pull
jimcast widget command git delete <branch> [--force] [--yes|--cancel]
jimcast widget command git prune [--yes|--cancel]
```

## Keys

`f` fetch · `p` pull · `r` local/remote · `d` delete · `shift+d` force delete · `m` prune merged ·
`shift+y` confirm · `n` cancel · `]` next repo · `[` previous repo.

Remap in `~/.jimcast/keybinding.json`:

```json
"widgets": { "<plugin id>": { "fetch": "f" } }
```

## State

`~/.jimcast/plugin-data/<plugin id>/{repos,repo,remote,msg,confirm}`.

## Differences from the built-in

- **State moved** to `~/.jimcast/plugin-data/<plugin id>/` (it is the same path the built-in
  header documents, built from `pluginId()`). Copy your `repos` file there to keep tracked repos.
- All code lives in one file, `src/index.ts`.
- `shellExec` options (`ignore_exit_code`, `trim_output`, `timeout_secs`) are dropped. Long
  fetch/pull/scan calls no longer have the 60 s timeout hint.
- Actions are closures with pre-quoted values instead of `{r}` / `{b}` / `{p}` interpolation.
- Item ids use the prefix `extgb` instead of `gb`.
- `theme.*` is replaced by `ctx.host.theme.colors` with fallbacks and local font constants.
- CLI examples assume the `git` alias above.
