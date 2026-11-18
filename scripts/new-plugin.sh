#!/usr/bin/env bash
# Scaffold a new plugin from templates/plugin.
# Usage: scripts/new-plugin.sh <name>        (lowercase letters, digits, dashes)
# Creates plugins/<name> with package name com.<company/personal>-<name>.
set -euo pipefail
name="${1:?usage: new-plugin.sh <name>}"
[[ "$name" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "name must match ^[a-z][a-z0-9-]*$"; exit 1; }
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/plugins/$name"
[ -e "$dest" ] && { echo "plugins/$name already exists"; exit 1; }
# item-id prefix: "ext" + initials, e.g. my-timer -> extmt
short="ext$(echo "$name" | tr '-' '\n' | cut -c1 | tr -d '\n')"
cp -R "$root/templates/plugin" "$dest"
find "$dest" -type f -exec sed -i.bak -e "s/__NAME__/$name/g" -e "s/__SHORT__/$short/g" {} \; -exec rm -f {}.bak \;
echo "created plugins/$name  (item-id prefix: $short, CLI spec: x$name)"
echo "next: pnpm install && ./scripts/install.sh plugins/$name"
