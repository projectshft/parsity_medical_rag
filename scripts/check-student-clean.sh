#!/usr/bin/env bash
# Guard: the `student` branch (what students fork) must never contain the
# LMS, the curriculum, or instructor-only infrastructure. Run this ON the
# student branch after any sync from main. Exits non-zero if anything
# forbidden is tracked.
set -euo pipefail

forbidden=(
  "curriculum/"
  "app/learn/"
  "app/admin/"
  "lib/lms/"
  "prisma/lms/"
  "middleware.ts"
  "docs/LMS-SETUP.md"
)

branch="$(git rev-parse --abbrev-ref HEAD)"
echo "Checking tracked files on '$branch' for forbidden LMS/curriculum paths..."

failed=0
for path in "${forbidden[@]}"; do
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1 || \
     [ -n "$(git ls-files "$path" 2>/dev/null)" ]; then
    echo "  ✗ FORBIDDEN: $path is tracked"
    failed=1
  fi
done

# Clerk dep must not reach student package.json
if git show HEAD:package.json 2>/dev/null | grep -q '@clerk/nextjs'; then
  echo "  ✗ FORBIDDEN: @clerk/nextjs is in package.json"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "FAIL: LMS/curriculum leaked onto '$branch'. Remove these before students fork it."
  exit 1
fi
echo "OK: '$branch' is clean."
