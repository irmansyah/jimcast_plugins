#!/usr/bin/env bash
# Alias of install.sh (same name as core's scripts/sync-plugin.sh).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/install.sh" "$@"
