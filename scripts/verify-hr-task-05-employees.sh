#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/CRM
FILE="convex/hrEmployees.ts"
if [ ! -f "$FILE" ]; then
  echo "missing employee API file: $FILE"
  exit 1
fi
for needle in "export const list" "export const getById" "export const create" "export const update" "export const updateStatus" "organizationId_nik" "assertBranchAccess"; do
  if ! grep -q "$needle" "$FILE"; then
    echo "missing employee API symbol: $needle"
    exit 1
  fi
done
echo "HR employee API verification passed"
