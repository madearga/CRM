#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrAttendance.ts"
if [ ! -f "$FILE" ]; then
  echo "missing attendance API file: $FILE"
  exit 1
fi
for needle in "clockInFromWhatsApp" "clockOutFromWhatsApp" "getDailySummary" "getByEmployee" "autoCloseOpenRecords" "forgot_clockout" "hr_attendance"; do
  if ! grep -q "$needle" "$FILE" convex/crons.ts; then
    echo "missing attendance API symbol: $needle"
    exit 1
  fi
done
echo "HR attendance API verification passed"
