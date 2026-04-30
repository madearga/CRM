#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
PERMS="convex/permissionHelpers.ts"
FUNCS="convex/functions.ts"
for needle in "'hr_employees'" "'hr_attendance'" "'hr_shifts'" "'hr_reports'" "'hr_branches'" "'hr_holidays'" "'export'"; do
  if ! grep -q "$needle" "$PERMS"; then
    echo "missing permission entry: $needle"
    exit 1
  fi
done
if ! grep -q "export const createOrgAction" "$FUNCS"; then
  echo "missing createOrgAction wrapper"
  exit 1
fi
echo "HR permission verification passed"
