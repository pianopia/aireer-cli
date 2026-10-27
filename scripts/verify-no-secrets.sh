#!/usr/bin/env bash
# Verifies the working tree and all reachable git history contain no known leaked secret patterns.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ORPHAN_SHA="73f079a3905559763ff1bc4b84743398f701ef8f"
fail=0

echo "==> Scanning working tree..."
if git grep -E 'AIzaSy[0-9A-Za-z_-]{33}' -- . ':!scripts/verify-no-secrets.sh' 2>/dev/null; then
  echo "FAIL: Google API key pattern found in working tree"
  fail=1
fi
if git grep -E 'DATABASE_AUTH_TOKEN=eyJ' -- . 2>/dev/null; then
  echo "FAIL: Turso DATABASE_AUTH_TOKEN found in working tree"
  fail=1
fi

echo "==> Scanning reachable git history..."
if git log --all -G 'AIzaSy[0-9A-Za-z_-]{33}' --oneline 2>/dev/null | grep -q .; then
  echo "FAIL: Google API key pattern found in reachable history"
  git log --all -G 'AIzaSy[0-9A-Za-z_-]{33}' --oneline | head -5
  fail=1
fi
if git log --all -G 'DATABASE_AUTH_TOKEN=eyJ' --oneline 2>/dev/null | grep -q .; then
  echo "FAIL: Turso token pattern found in reachable history"
  git log --all -G 'DATABASE_AUTH_TOKEN=eyJ' --oneline | head -5
  fail=1
fi

echo "==> Checking orphan commit reachability from all refs..."
for ref in $(git for-each-ref --format='%(refname)'); do
  if git merge-base --is-ancestor "$ORPHAN_SHA" "$ref" 2>/dev/null; then
    echo "FAIL: Orphan commit $ORPHAN_SHA is reachable from $ref"
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  echo "OK: No hardcoded secrets in working tree or reachable history; orphan commit not on any ref."
  echo "NOTE: GitHub may still serve $ORPHAN_SHA by direct SHA until Support purges cached objects."
fi

exit "$fail"
