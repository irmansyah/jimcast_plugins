# Shell patterns (macOS)

## State in files

Plugin data lives only in the plugin data dir. Get paths from the SDK, never build them:

```ts
import { pluginDataFile } from "@jimcast/sdk";

const FILE = `"${pluginDataFile("count")}"`;   // absolute path, quoted at use
`echo 1 > ${FILE}`                              // no mkdir: the SDK creates the dir
```

`pluginDataFile(name)` takes a relative name matching `[A-Za-z0-9._/-]` (no spaces, no `..`) and creates its parent dirs.
A subfolder that scripts fill with user-named files (profiles, trash) is `pluginDataFile("profiles")`; the script still does `mkdir -p` on it.
Names with spaces or user text stay `shq`-quoted and are appended to that folder path: `"${PROFILES}/"${shq(name)}`.

Forbidden in plugin code: `~/.jimcast/...`, `$HOME`, `homedir()`, `/tmp`, `ext-` paths. Mark a user-chosen path (e.g. Finder browsing) with a `data-path-ok` comment on that line. `./scripts/check-data-paths.sh` enforces this.

Read in `render()` with `ctx.exec("cat ... 2>/dev/null")`. Treat missing files as defaults.
Prefer one line per record (`<a> <b> <c>`) or one value per line; parse with `split("\n")`.

## Quoting

```ts
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
ctx.exec(`open ${shq(path)}`)
```

Never put raw user text, file names or emoji into a script without `shq`.
Passing multi-line content: `printf %s ${shq(body)} > "$f"`.

## Idempotent edits

```sh
grep -Fxq -- "$v" "$f" || printf '%s\n' "$v" >> "$f"      # add once
grep -Fxv  -- "$v" "$f" > "$f.tmp"; mv "$f.tmp" "$f"       # remove
```

## Timestamps, not ticks

Store an end time, compute `remaining = end - now` at render. Correct even if the bar was hidden for minutes (pomodoro).

## Two-step destructive actions

Step 1 writes a timestamp file; step 2 refuses if older than N seconds and consumes it (finder Trash).
Move to Trash, don't `rm`: `/usr/bin/trash` on macOS 14+, else `osascript` Finder `delete`.

## Background work

```sh
( sleep $secs; osascript -e 'display notification "done"' ) >/dev/null 2>&1 </dev/null &
echo $! > "$f.pid"        # kill it later: kill $(cat "$f.pid")
```

Redirect stdin/stdout/stderr or the host may wait on the child. If it never fires, try `nohup`.

## Handy macOS tools

| Task | Command |
|---|---|
| clipboard | `printf %s "$x" \| pbcopy` |
| notification | `osascript -e 'display notification "m" with title "t"'` |
| open / reveal | `open path`, `open -R path` |
| thumbnail | `sips -Z 480 -s format jpeg in --out out` |
| file size / type | `stat -f%z f`, `file -b f` |
| md5 | `md5 -q` |
| zip | `zip -rq out.zip -@ < list.txt` |

The tool shell may be `sh`, not zsh/bash: avoid brace expansion and bashisms in scripts.
