# OSS Repo Inventory (full list — see LICENSES.md for policy)

Legend: ✅ verified usable · ⚠️ pending/unlicensed (integrate-by-interface only) · ❌ denied

## Liquidity / marketplace
- ✅ sudoswap/lssvm2 — AGPL-3.0 (vendored submodule, the NFT AMM)
- ✅ manifoldxyz/royalty-registry-solidity — MIT per-file SPDX (in lssvm2 lib)
- ✅ ProjectOpenSea/seaport + seaport-js — MIT
- ✅ DexKit/open-nft-marketplace — Apache-2.0 (reference; stack stale)
- ✅ thirdweb-example/marketplace-v3 — Apache-2.0 (patterns)
- ⚠️ Anvil/Clutch — BUSL-1.1 — index + route external markets only, never redeploy
- ⚠️ Reservoir — API/SDK MIT; core contracts unlicensed → API only
- ❌ NFTX v2/v3, Caviar — no license

## Funding / governance
- ✅ allo-v2 — AGPL-3.0 (QF strategies on-chain)
- ✅ MACI — MIT; PotLock — MIT; EAS — MIT; Safe — LGPL-3.0
- ✅ ranked-choice-voting — MIT
- ✅ Bread Coop: solidarity-fund, bread, builders-dollar, saving-circles — MIT
- ⚠️ tbsoc/pastry — unlicensed (ask sent); matching math clean-roomed in apps/web/src/lib/matching.ts
- ⚠️ Human Passport — NOASSERTION, verify before use
- ⚠️ ImpactHook — unlicensed, by-address

## Stablecoin / treasury (Phase B, from rooted-finance/abyayala vendored tree)
- ✅ dss (MakerDAO) AGPL-3.0; spark-psm AGPL-3.0; bond-protocol GPL-3.0
- ✅ balancer GPL-3.0; pendle GPL-3.0; euler GPL-2.0; yearn tokenized-strategy AGPL-3.0
- ✅ olympus-v3, reserve-index-dtf, reserve-governor, gmx, trusted-fillers, prb-math — MIT
- ✅ OpenZeppelin, solmate, createx, v4-hooks-public — MIT
- ⚠️ Uniswap v4-core — verify

## Frontend / dApp
- ✅ scaffold-eth-2 — MIT (vendored as Equinox in abyayala)
- ✅ wagmi, viem — MIT; Ponder — MIT (indexer alt)
- ✅ Enricrypto/nft-marketplace MIT; Trynax/Stage-raise MIT; RST-Reputation MIT (abyayala wrappers)
- ✅ Unlock Protocol — MIT (pay-per-look/watch/listen)
- ✅ Charged Particles — MIT (optional yield-bearing patronage NFTs)
- ✅ ENS app — MIT
- ❌ @metamask/sdk — ConsenSys non-commercial → stubbed via npm override

## Graph / coordination
- ✅ liminalvillage/holons — AGPL-3.0-or-later (upstream-collab)
- ⚠️ artizen-fyi — unlicensed (data collab only)

## In-house OSS (ours)
- rooted-finance, abyayala, PledgeLine (rad:z3nzLpgDNC2qYWw5f5mFHFKChTLzb) — AGPL-3.0
