# Vendored: javruben/naoms-flow-funding

- Source: https://github.com/javruben/naoms-flow-funding (mirror)
- Commit: 7d1a265ec70eee5685feb233e374f0ad09f8ec79 (2026-09-24)
- License: MIT (see LICENSE)
- Files: engine/{accrual,activity-decay,allocate,gradient}.ts (pure, zero-dep),
  sim/driver.ts (simulation over the engines), domain/agreement.ts (types/fold),
  ui/* (reference surfaces).
- Excluded: handlers/, materializers/, sharing/, domain/{flow-ocap,engine-key-registry,
  settlement-confirm-hook}.ts — they require the unpublished @naoms/core substrate;
  their semantics are re-implemented in workers/indexer (epoch-settle) over D1+EAS.
- Upstream-sync rule: fixes/enhancements PR'd upstream; re-vendor on upstream updates.
