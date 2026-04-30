#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrBranches.ts"
if [ ! -f "$FILE" ]; then
  echo "missing branch API file: $FILE"
  exit 1
fi
for needle in "export const list" "export const getById" "export const create" "export const update" "export const regenerateQr" "hr_branches" "makeBranchQrCode"; do
  if ! grep -q "$needle" "$FILE"; then
    echo "missing branch API symbol: $needle"
    exit 1
  fi
done
echo "HR branch API verification passed"
