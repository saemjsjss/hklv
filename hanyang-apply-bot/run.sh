#!/usr/bin/env bash
# Fill every student (dry run — does NOT submit). Set HY_SUBMIT=true to submit.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run fill
