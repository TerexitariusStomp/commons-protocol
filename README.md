# Commons Protocol

An open-source public-goods flywheel: an NFT marketplace whose volume grows
liquidity pools, whose pools create stablecoin demand, whose stablecoin
reserves grow an endowment (the Pot), whose yield funds public goods — which
launch new collections.

```
marketplace volume → pool growth → stablecoin demand → Pot endowment
→ yield-funded matching → funded projects → new collections → loop
```

## Layout

```
contracts/   Foundry workspace
  src/       CommonsPot (ERC-4626 hold-or-exit endowment)
  script/    DeployCommons.s.sol (sudoswap lssvm2 liquidity layer), CreatePool.s.sol
  lib/lssvm2 sudoswap v2 submodule (AGPL-3.0) — the NFT AMM
apps/web     Vite + React + wagmi marketplace frontend
workers/     Cloudflare Workers
  indexer/   D1 + cron event indexer (pools, swaps, funds, claims, artifacts)
  claims/    Telegram-bot claim webhook (consent-based project rescue)
scripts/     check-licenses.mjs, custom-loc-budget.sh, census-artifacts.mjs
docs/        LICENSES.md, LICENSE-ASKS.md, HOLONS-DATA-MODEL.md
vendor/      local stub packages (e.g. @metamask/sdk → MIT stub)
```

## Principles

- **OSS-first**: every dependency commercially usable; copyleft fine.
  `npm run licenses` enforces it.
- **<5% custom code**: `npm run loc` measures custom vs vendored LOC; CI fails ≥5%.
- **No new tokens at launch**: pools hold NFTs + stablecoin directly;
  reputation is points/EAS; Pot shares are ERC-4626 receipts.
- **No secrets in repo**: keys via env / `wrangler secret put`.

## Deploy (Sepolia)

```bash
cd contracts
export PRIVATE_KEY=… SAFE_MULTISIG=0x… POT_ADDRESS=0x…
forge script script/DeployCommons.s.sol --rpc-url $SEPOLIA_RPC --broadcast

# create a fixed-price ERC-1155 pool (e.g. an Artizen Artifact edition)
export FACTORY=… BONDING_CURVE=… NFT=… NFT_ID=… TOKEN=… SPOT_PRICE=…
forge script script/CreatePool.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

## Gates

```bash
npm ci
npm run licenses      # license policy
npm run loc           # custom < 5%
cd contracts && forge test
npm run build:web
```
