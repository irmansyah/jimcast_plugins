#!/usr/bin/env bash
# scripts/install.sh <plugin> [--no-build]      (also: --all)
#
# Builds a plugin and copies it to ~/.jimcast/plugins/<package name>/.
# <plugin> is a folder name (pomodoro), or a path (plugins/pomodoro, examples/hello, ./my-plugin).
# It looks in plugins/ and examples/ of this repo.
#
# Plugin flavors are auto-detected:
#   - react:   has vite.config.ts (webview UI)   -> dist/ (+ optional dist-backend/)
#   - native:  has tsdown.config.ts, no webview  -> dist/ only
#   - unknown: neither found; builds anyway and copies whatever dist/ appears
#
# Env: JIMCAST_PLUGINS_DIR overrides the destination root (default: ~/.jimcast/plugins).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dest_root="${JIMCAST_PLUGINS_DIR:-$HOME/.jimcast/plugins}"

usage() { echo "usage: install.sh <plugin|path> [--no-build]   |   install.sh --all" >&2; exit 1; }

# --- args ----------------------------------------------------------------------
build=1; target=""; all=0
for a in "$@"; do
  case "$a" in
    --no-build) build=0 ;;
    --all)      all=1 ;;
    -h|--help)  usage ;;
    -*)         echo "unknown flag: $a" >&2; usage ;;
    *)          [ -z "$target" ] && target="$a" || usage ;;
  esac
done

if [ "$all" = 1 ]; then
  for d in "$root"/plugins/*/; do
    "$0" "$d" $([ "$build" = 0 ] && echo --no-build)
  done
  exit 0
fi
[ -n "$target" ] || usage

# --- resolve the plugin folder ---------------------------------------------------
resolve() {
  local a="${1%/}"
  if [ -d "$a" ]; then (cd "$a" && pwd); return 0; fi
  if [ -d "$root/$a" ]; then (cd "$root/$a" && pwd); return 0; fi
  for base in plugins examples; do
    if [ -d "$root/$base/$a" ]; then (cd "$root/$base/$a" && pwd); return 0; fi
  done
  return 1
}
src="$(resolve "$target")" || { echo "error: plugin '$target' not found (looked in plugins/ and examples/)" >&2; exit 1; }
[ -f "$src/package.json" ] || { echo "error: $src has no package.json" >&2; exit 1; }

# The installed folder must equal the package name: core routes widget ids on it.
name="$(node -p "require('$src/package.json').name")"
dst="$dest_root/$name"

# --- detect plugin type ----------------------------------------------------------
if   [ -f "$src/vite.config.ts" ];   then kind="react"
elif [ -f "$src/tsdown.config.ts" ]; then kind="native"
else
  echo "warning: could not detect plugin type for '$name' (no vite.config.ts or tsdown.config.ts), building anyway" >&2
  kind="unknown"
fi
echo "==> $name (detected: $kind)"

# --- build -------------------------------------------------------------------------
if [ "$build" = 1 ]; then
  pnpm --dir "$src" build
fi

mkdir -p "$dst"

# Mirror a directory (deletes files that no longer exist in the source).
# rsync when available, plain cp otherwise.
sync_dir() {
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$1/" "$2/"
  else
    rm -rf "$2"; mkdir -p "$2"; cp -R "$1/." "$2/"
  fi
}

# --- frontend / build output -------------------------------------------------------
if [ -d "$src/dist" ]; then
  sync_dir "$src/dist" "$dst/dist"
else
  echo "warning: no dist/ produced for '$name'" >&2
fi

# --- metadata files (copy whichever exist) -----------------------------------------
cp "$src/package.json" "$dst/package.json"
for f in manifest.json config.json; do
  if [ -f "$src/$f" ]; then cp "$src/$f" "$dst/$f"; fi
done

# --- backend process entry (react plugins, if present) -----------------------------
# Webview-only plugins with no host-communication needs may not have one, but a stub
# backend can still exist with an empty handler map (see jimcast-react-rest).
if [ -d "$src/dist-backend" ]; then
  sync_dir "$src/dist-backend" "$dst/dist-backend"
fi

echo "==> installed '$name' ($kind) -> $dst  (reload jimcast-core)"
