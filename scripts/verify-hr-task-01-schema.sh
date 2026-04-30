#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
SCHEMA="convex/schema.ts"
for needle in "branches:" "employees:" "shifts:" "shiftAssignments:" "attendanceRecords:" "attendanceCorrections:" "holidays:" "organizationId_branchId_date" "organizationId_userId"; do
  if ! grep -q "$needle" "$SCHEMA"; then
    echo "missing schema entry: $needle"
    exit 1
  fi
done
npx convex dev --once >/tmp/hr-task-01-convex.log 2>&1 || { cat /tmp/hr-task-01-convex.log; exit 1; }
echo "HR schema verification passed"
