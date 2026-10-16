#!/usr/bin/env bash
# Custom-code budget: new commons-protocol code must stay below 5% of the
# OSS/vendor baseline it composes. Baseline = vendored Solidity libs
# (contracts/lib) plus vendored JS deps (apps/web/node_modules).
# Custom = contracts/{src,test,script} + workers/*/src + apps/web/src.
set -euo pipefail
cd "$(dirname "$0")/.."

baseline_sol=$(find contracts/lib -type f \( -name '*.sol' -o -name '*.vy' \) -exec cat {} + 2>/dev/null | wc -l)
baseline_js=0
if [ -d apps/web/node_modules ]; then
  baseline_js=$(find apps/web/node_modules -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -exec cat {} + 2>/dev/null | wc -l)
fi
baseline=$((baseline_sol + baseline_js))

custom=$(find \
  contracts/src contracts/test contracts/script \
  workers \
  apps/web/src \
  -type f \( -name '*.sol' -o -name '*.vy' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) \
  -exec cat {} + 2>/dev/null | wc -l)

if [ "$baseline" -eq 0 ]; then
  echo "no vendored baseline yet — submodules/deps not initialized" >&2
  exit 0
fi

pct=$(echo "scale=3; $custom * 100 / $baseline" | bc)
echo "vendored baseline: $baseline LOC (sol: $baseline_sol, js: $baseline_js)"
echo "custom code: $custom LOC ($pct% of baseline)"
if [ "$(echo "$pct >= 5" | bc)" = "1" ]; then
  echo "FAIL: custom code exceeds 5% budget" >&2
  exit 1
fi
echo "OK: under the 5% custom-code budget"
