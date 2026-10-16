# OSS License Inventory

Policy: every dependency must be commercially usable. Copyleft is fine.
BSL/SSPL/Elastic/non-commercial/unlicensed production deps are denied by
`scripts/check-licenses.mjs` and fail CI.

## Vendored (in-repo)

| Repo | License | Integration |
|---|---|---|
| sudoswap/lssvm2 | AGPL-3.0 | `contracts/lib/lssvm2` submodule — NFT liquidity layer |
| manifoldxyz/royalty-registry-solidity | MIT (per-file SPDX) | inside lssvm2 lib — royalty engine |
| OpenZeppelin contracts (+upgradeable) | MIT | inside lssvm2 lib |
| solmate | MIT | inside lssvm2 lib |
| clones-with-immutable-args | BSD | inside lssvm2 lib |
| prb-math | MIT | inside lssvm2 lib |
| forge-std / ds-test | MIT / Apache-2.0 | inside lssvm2 lib (test only) |
| vendor/metamask-sdk-stub | MIT | replaces ConsenSys non-commercial `@metamask/sdk` (npm override) |

## Interface/ABI integration (deployed contracts — no code copied)

| Repo | License | Integration |
|---|---|---|
| Seaport / seaport-js | MIT | P2P offers + orders |
| Reservoir | API/SDK only (core unlicensed) | order aggregation |
| Anvil/Clutch | BUSL-1.1 | external markets indexed + routed only — never redeployed |
| Unlock Protocol | MIT | pay-per-look/watch/listen, NFT-gated media |
| EAS | MIT | claim + impact attestations |
| Safe contracts | LGPL-3.0 | 4/5 admin multisig |

## Upstream-collaboration (PR protocol, not vendored until licensed)

| Repo | License | Status |
|---|---|---|
| tbsoc/pastry | none — license ask pending | contribution fork, QF math reimplemented clean-room |
| liminalvillage/holons | AGPL-3.0-or-later | graph substrate; PRs upstream |
| ImpactHook | unlicensed | by-address only |
| artizen-fyi | unlicensed | data collab only |

## Sister in-house repos (ours, AGPL-3.0)

- rooted-finance / abyayala monorepo (AyniToken, MilestoneFunding, ReputationEngine…)
- PledgeLine (rad:z3nzLpgDNC2qYWw5f5mFHFKChTLzb) — escrow, MatchPool, EAS worker, license+LOC gates (ported here)

## Custom-code budget

`scripts/custom-loc-budget.sh` — custom / vendored must stay < 5%.
Current: ~1K custom vs ~273K vendored.
