#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
for file in convex/hrCorrections.ts convex/hrHolidays.ts; do
  if [ ! -f "$file" ]; then
    echo "missing HR correction/holiday file: $file"
    exit 1
  fi
done
for needle in "export const request" "export const review" "export const listPending" "approved" "rejected" "export const importBulk" "isRecurring" "hr_holidays"; do
  if ! grep -q "$needle" convex/hrCorrections.ts convex/hrHolidays.ts; then
    echo "missing correction/holiday symbol: $needle"
    exit 1
  fi
done
echo "HR corrections and holidays verification passed"
