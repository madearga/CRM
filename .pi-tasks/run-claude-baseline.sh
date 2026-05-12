#!/usr/bin/env bash
set -euo pipefail
cd /Users/madearga/Desktop/crm/.worktrees/quality-audit-cleanup
claude \
  --model sonnet \
  --permission-mode bypassPermissions \
  --append-system-prompt 'You are a concise coding worker. Implement carefully. Do not ask unless blocked. Return STATUS/SUMMARY/VERIFICATION/COMMIT/CONCERNS.' \
  -p < .pi-tasks/baseline-cleanup.md
status=$?
echo "__CLAUDE_BASELINE_DONE__:$status"
exit "$status"
