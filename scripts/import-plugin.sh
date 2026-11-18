#!/usr/bin/env bash
# Move an existing standalone plugin (e.g. jim-finder) into this repo.
# Usage: scripts/import-plugin.sh ~/works/jimcast/jim-finder
set -euo pipefail
src="${1:?usage: import-plugin.sh <path to plugin>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$(node -p "require('$src/package.json').name")"
short="${2:-${pkg#jim-}}"; short="${short##*.}"   # optional 2nd arg = folder name
dest="$root/plugins/$short"
[ -e "$dest" ] && { echo "plugins/$short already exists"; exit 1; }
mkdir -p "$dest"
cp -R "$src/src" "$src/package.json" "$dest/"
[ -f "$src/tsdown.config.ts" ] && cp "$src/tsdown.config.ts" "$dest/"
[ -f "$src/README.md" ] && cp "$src/README.md" "$dest/"
printf '{\n  "extends": "../../tsconfig.base.json",\n  "include": ["src"]\n}\n' > "$dest/tsconfig.json"
node -e '
const fs=require("fs"),p=process.argv[1];
const d=JSON.parse(fs.readFileSync(p));
d.dependencies={"@jimcast/protocol":"*","@jimcast/sdk":"*"};
d.license="MIT";
fs.writeFileSync(p,JSON.stringify(d,null,2)+"\n");
' "$dest/package.json"
echo "imported $pkg -> plugins/$short"
echo "next: pnpm install, then add a row to README.md and docs/plugin-catalog.md"
