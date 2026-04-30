#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrReports.ts"
if [ ! -f "$FILE" ]; then
  echo "missing reports API file: $FILE"
  exit 1
fi
for needle in "export const getAttendanceReport" "export const getMonthlySummary" "export const exportCSV" "createOrgAction" "csvEscape" "holiday" "hr_reports"; do
  if ! grep -q "$needle" "$FILE"; then
    echo "missing reports API symbol: $needle"
    exit 1
  fi
done
echo "HR reports API verification passed"
