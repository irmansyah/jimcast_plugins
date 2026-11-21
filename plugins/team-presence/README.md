# jim-team-presence

A compact Slack-style team presence board: a summary line (`2 active · 1 dnd · 1 offline`), then one row
per person with a status dot, name, note and their local time. Enter on a row opens its `url`
(`http(s)://` and `slack://` only). Shows at most 8 rows, then "… n more". Refreshes every 30 s.

## Install

```bash
jimcast plugin install team-presence
# or by package id:
jimcast plugin install com.jimcast.plugins.team-presence
```

This downloads the plugin from the plugin registry, installs its dependencies,
builds it (the SDK is bundled in), copies the result to
`~/.jimcast/plugins/<plugin id>/`, adds a `team-presence` alias to the `widgets`
map in `~/.jimcast/config.json` (if it isn't there yet), and asks the running
jimcast-core to reload. It needs `git`, `node`, `pnpm` and `bash`.

The plugin id is the `name` in `package.json`. The alias that gets added is:

```json
"widgets": { "team-presence": { "use": "com.jimcast.plugins.team-presence" } }
```

The alias only declares the widget. To show it, place `team-presence` in a
section of your layout (`config_section.json`).

Plugin processes outlive reloads, so if you reinstall over a running copy,
fully quit and relaunch jimcast-core.

### Install from a local checkout (plugin development)

```bash
./scripts/install.sh team-presence
```

This does the same build and copy from your working tree, without cloning. It
does not touch `config.json` or reload the app, so add the alias above by hand
and relaunch jimcast-core.

## Data

Create `team.json` in `~/.jimcast/plugin-data/<plugin id>/`, by hand or from a script/cron:

```json
{ "members": [
  { "name": "Alice Kim", "status": "active", "note": "reviewing PRs",
    "tz": "Asia/Seoul", "url": "slack://user?team=T123&id=U456" },
  { "name": "Bob", "status": "dnd", "note": "in a meeting", "tz": "Europe/London" }
] }
```

`status`: `active | dnd | away | offline` (`online` = active, `busy` = dnd). Names must be unique.

## Differences from the built-in

- `team.json` moved from `~/.jimcast/team.json` to `~/.jimcast/plugin-data/<plugin id>/team.json`.
  Move or re-point any script that writes it.
- Shell options (`ignore_exit_code`, `trim_output`) are dropped; the plugin trims output itself.
- Row action is a closure (`{ run, then: "dismiss" }`) instead of `cmd: 'open {u}'` with params.
- Colors come from the host theme with hard-coded fallbacks; font sizes are local constants.
- Item ids use the `extteam` prefix so they do not clash with the built-in.
- The empty-state hint no longer names a path (the built-in text referenced `~/.jimcast/int-team/`, which
  did not match the code).
