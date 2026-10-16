#!/usr/bin/env bash
# Custom-code budget: new commons-protocol code must stay below 5% of the
# OSS/vendor baseline it composes.
#
# Baseline = vendored Solidity libs (contracts/lib, incl. submodule libs)
#          + vendored upstream source (vendor/upstream/** — MIT/AGPL copies)
#          + vendored JS/TS deps (node_modules, npm-hoisted at root and any
#            nested workspace copies).
# Custom   = contracts/{src,test,script} + workers/*/src + apps/*/src
#          + scripts/*.mjs.
# Measurement is deliberately inclusive on the custom side so the metric
# can't be gamed by parking logic outside src/.
set -euo pipefail
cd "$(dirname "$0")/.."

baseline_sol=$(find contracts/lib -type f \( -name '*.sol' -o -name '*.vy' \) -exec cat {} + 2>/dev/null | wc -l)
baseline_js=$(find vendor/upstream -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -exec cat {} + 2>/dev/null | wc -l)
for nm in node_modules apps/*/node_modules workers/*/node_modules; do
  if [ -d "$nm" ]; then
    n=$(find "$nm" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -exec cat {} + 2>/dev/null | wc -l)
    baseline_js=$((baseline_js + n))
  fi
done
baseline=$((baseline_sol + baseline_js))

custom=$(find \
  contracts/src contracts/test contracts/script \
  workers \
  apps \
  scripts \
  -type f \( -name '*.sol' -o -name '*.vy' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) \
  -not -path '*/node_modules/*' \
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
