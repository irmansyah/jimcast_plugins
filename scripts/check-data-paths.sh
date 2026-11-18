#!/usr/bin/env bash
# Usage: scripts/check-data-paths.sh 
# Fails if plugin code builds data paths itself. Plugin data: pluginDataDir() / pluginDataFile().
# Escape hatch for user-chosen paths (e.g. Finder browsing): add `data-path-ok` in a comment on that line.
set -u
cd "$(dirname "$0")/.."

PATTERN='\.jimcast|homedir|\$HOME|/tmp|\bext-|jimcast-external'
dirs=()
for d in plugins/*/src examples/*/src templates/plugin/src; do [ -d "$d" ] && dirs+=("$d"); done

hits=$(rg -n --no-heading "$PATTERN" "${dirs[@]}" --glob '!*.bak' | grep -v 'data-path-ok')
if [ -n "$hits" ]; then
  echo "Forbidden data-path usage (use pluginDataDir()/pluginDataFile()):"
  echo "$hits"
  exit 1
fi
echo "check-data-paths: OK"
