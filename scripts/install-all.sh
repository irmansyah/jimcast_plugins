#!/usr/bin/env bash
# Build and install every plugin in plugins/.  Same as: install.sh --all
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/install.sh" --all "$@"
