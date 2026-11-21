# jim-team-presence

A compact Slack-style team presence board: a summary line (`2 active · 1 dnd · 1 offline`), then one row
per person with a status dot, name, note and their local time. Enter on a row opens its `url`
(`http(s)://` and `slack://` only). Shows at most 8 rows, then "… n more". Refreshes every 30 s.

## Install

```sh
./scripts/install.sh jim-team-presence
```

Add the alias to `~/.jimcast/config.json`:

```json
"widgets": { "team": { "use": "com.jimcast.plugins.team-presence" } }
```

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
