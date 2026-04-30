#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrShifts.ts"
if [ ! -f "$FILE" ]; then
  echo "missing shift API file: $FILE"
  exit 1
fi
for needle in "export const list" "export const create" "export const update" "export const remove" "hr_shifts" "lateToleranceMinutes" "daysOfWeek"; do
  if ! grep -q "$needle" "$FILE"; then
    echo "missing shift API symbol: $needle"
    exit 1
  fi
done
echo "HR shift API verification passed"
