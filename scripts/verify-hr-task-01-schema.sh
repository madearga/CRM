#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SCHEMA="convex/schema.ts"
for needle in "branches:" "employees:" "shifts:" "shiftAssignments:" "attendanceRecords:" "attendanceCorrections:" "holidays:" "organizationId_branchId_date" "organizationId_userId"; do
  if ! grep -q "$needle" "$SCHEMA"; then
    echo "missing schema entry: $needle"
    exit 1
  fi
done
pnpm backend:push >/tmp/hr-task-01-convex.log 2>&1 || { cat /tmp/hr-task-01-convex.log; exit 1; }
echo "HR schema verification passed"
