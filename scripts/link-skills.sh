#!/usr/bin/env bash
# Make Claude Code pick up the skill in this repo: .claude/skills -> ../skills
# (A symlink, so skills/ stays the single copy that every other agent can read too.)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/.claude"
ln -sfn ../skills "$root/.claude/skills"
echo "linked .claude/skills -> ../skills"
