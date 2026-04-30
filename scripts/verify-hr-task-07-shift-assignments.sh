#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrShiftAssignments.ts"
if [ ! -f "$FILE" ]; then
  echo "missing shift assignment API file: $FILE"
  exit 1
fi
for needle in "export const assign" "export const remove" "export const getSchedule" "export const getByEmployee" "recurrenceType" "weekly" "specificDate"; do
  if ! grep -q "$needle" "$FILE"; then
    echo "missing shift assignment API symbol: $needle"
    exit 1
  fi
done
echo "HR shift assignment API verification passed"
