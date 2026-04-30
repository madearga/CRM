#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
for file in convex/hrTypes.ts convex/hrUtils.ts; do
  if [ ! -f "$file" ]; then
    echo "missing HR shared file: $file"
    exit 1
  fi
done
for needle in "employeeStatusSchema" "attendanceStatusSchema" "attendanceLabelSchema" "shiftRecurrenceSchema" "getDateKey" "calculateAttendanceTiming" "csvEscape" "assertBranchAccess"; do
  if ! grep -q "$needle" convex/hrTypes.ts convex/hrUtils.ts; then
    echo "missing HR shared symbol: $needle"
    exit 1
  fi
done
echo "HR shared verification passed"
