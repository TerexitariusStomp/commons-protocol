# The Commons Protocol

### An open marketplace where collecting art funds the commons

**Whitepaper — v0.1 (community draft)**

---

## Abstract

When Artizen shut down, thousands of public-goods projects — and the artifacts minted to fund them — were left without a home. **Commons Protocol** is an open-source marketplace and funding engine built to carry that archive forward and give it a permanent economic engine.

The idea is simple: **every artifact sale does three things at once** — it pays the seller, sends a share to the project behind the artifact, and feeds a community-owned endowment called **the Pot**. The Pot never spends its principal; its yield is what matches community contributions to projects and funds each season. Community members steer where that matching goes using **points** earned by participating.

This paper explains every element of the protocol in plain language — no prior crypto knowledge required — and is honest about what exists today versus what is still on the roadmap. Chapters are tagged **Live**, **In progress**, or **Planned** so you always know what is real.

```
marketplace sales → fees + royalties → the Pot endowment
        → yield-funded matching → funded projects → new collections → loop
```

---

## Table of Contents

**Part I — Welcome**
1. [What is Commons?](#1-what-is-commons)
2. [If you were on Artizen](#2-if-you-were-on-artizen)
3. [Web3 in five minutes](#3-web3-in-five-minutes)

**Part II — The marketplace**
4. [The Marketplace](#4-the-marketplace)
5. [Artifacts and the Artizen archive](#5-artifacts-and-the-artizen-archive)
6. [Where the money goes on a sale](#6-where-the-money-goes-on-a-sale)
7. [Liquidity pools](#7-liquidity-pools)

**Part III — The funding engine**
8. [The Pot](#8-the-pot)
9. [Projects and claims](#9-projects-and-claims)
10. [Funds and matching](#10-funds-and-matching)
11. [Points and seasons](#11-points-and-seasons)
12. [Flow funding](#12-flow-funding)
13. [Pledges](#13-pledges)

**Part IV — What is coming**
14. [A collateral-backed stablecoin](#14-a-collateral-backed-stablecoin)
15. [Protocol-owned liquidity](#15-protocol-owned-liquidity)
16. [Milestone verification](#16-milestone-verification)
17. [Creator tools](#17-creator-tools)
18. [Data revenue](#18-data-revenue)
19. [Governance](#19-governance)

**Part V — Reference**
20. [Ecosystem and integrations](#20-ecosystem-and-integrations)
21. [Technical annex](#21-technical-annex)
22. [Trust assumptions and risks](#22-trust-assumptions-and-risks)
23. [Roadmap](#23-roadmap)
24. [Glossary](#24-glossary)
25. [FAQ](#25-faq)

---

# Part I — Welcome

## 1. What is Commons?

> **Status: Live** (marketplace, archive, points) · **In progress** (on-chain settlement)

Commons is two things joined at the hip:

1. **An open NFT marketplace** — anyone can list, buy, and sell digital artifacts. It looks and works like the marketplaces you know: browse collections, filter by traits, make offers, check out.
2. **A public-goods funding engine** — built into every sale. A slice of each purchase goes to the project that the artifact belongs to, and a small protocol fee feeds a shared endowment whose yield matches community funding forever.

Most marketplaces extract fees and keep them. Commons routes them into a flywheel:

```
Someone buys an artifact
        │
        ├─→ Seller gets paid
        ├─→ The project behind it gets its share (up to 5% once claimed)
        └─→ 0.5% goes to the Pot
                  │
                  └─→ The Pot's yield matches community funding each season
                            │
                            └─→ Funded projects launch new collections
                                       │
                                       └─→ which drive more sales
```

Every turn of that loop grows the endowment and the number of funded projects. The marketplace is not a cost center attached to a funding mechanism — it *is* the funding mechanism.

### Design principles

- **Open source, OSS-first.** Every dependency is commercially usable; copyleft is fine. Less than 5% of the codebase is custom code — the rest is vendored open source with licenses tracked in-repo.
- **No new token at launch.** There is no COMMONS token to speculate on. Pools hold NFTs and stablecoin directly; reputation is points; Pot shares are ERC-4626 receipts that can always be redeemed.
- **Honest status.** Live features work today; everything else is labeled and never presented as functional before it is.

## 2. If you were on Artizen

> **Status: Live**

Artizen went offline. Your work did not disappear.

The complete Artizen archive has been preserved and seeded into Commons:

- **3,375 projects** — every project page exists at `/projects/your-slug`, with its original description.
- **258 funds** — the matching funds, with their member projects and taglines.
- **176 artifacts** — the Artizen Artifacts collection, each one linked to its project.

### Claiming your project

Your project page is already claimable:

1. Open your project page (find it under **Explore → Projects**).
2. Connect the wallet that should act as the project's treasury.
3. Sign the claim message — a signature, not a transaction, costs nothing.
4. Set the share of artifact sales you want to receive (0–5%).

Until you claim, the share earmarked for your project (10% by default on unclaimed artifacts) accumulates in escrow at the Pot. Once claimed, proceeds route to your treasury wallet and **you earn 1,000 alumni points** toward steering seasonal matching.

### What is different from Artizen

| Artizen | Commons |
|---|---|
| Platform-owned marketplace | Open-source protocol, anyone can run it |
| Grants decided by platform | Matching steered by member points |
| Projects ended with the site | Projects, funds, artifacts live on-chain and in a public indexer |
| Per-season events | Continuous marketplace + rolling 90-day seasons |

## 3. Web3 in five minutes

> **Status: Reference**

Skip this if you already use a wallet.

- **A blockchain** is a public notebook that nobody can erase. Thousands of computers keep identical copies, so records can be trusted without trusting any one company.
- **A wallet** is your keychain: it proves "this is me" by signing messages — like a signature that is mathematically unforgeable. Your wallet address is public (like a username); your private key is secret (like a password you never share).
- **A smart contract** is a vending machine: a program on the blockchain that follows its rules exactly — put in money, get the thing — with no company in the middle able to change the rules later.
- **An NFT** is a token that says "you own this specific item" — in our case, an artifact edition minted to fund a project.
- **A stablecoin** is a token designed to stay worth about $1 (like USDC). It lets people trade digital items in dollar terms without price swings.
- **A signature vs. a transaction**: signing a message with your wallet is free and changes nothing on-chain — Commons uses signatures for claims, pledges, and point allocation. A *transaction* costs gas and changes the blockchain. We only ask for transactions when money actually moves.

---

# Part II — The marketplace

## 4. The Marketplace

> **Status: Live**

The marketplace is a full NFT marketplace experience — explore grids, collection pages with banner mosaics, trait filters, owner profiles, offers, and checkout — built on open components rather than a proprietary platform.

Key surfaces:

- **Explore** — browse NFTs, collections, users, **projects**, and **funds** from one place.
- **Collection pages** — banner mosaic built from the collection's own artwork, stats row, sidebar filters, dense item grid.
- **Trait filters that mean something** — artifacts carry `Project` and `Fund` traits, so filtering the grid by a project shows exactly the artifacts that support it.
- **Token pages** — each artifact shows its artwork, metadata, traits, and a badge telling you what share of each sale supports which project.

Everything you see is served by a public indexer (`commons-indexer`) that mirrors on-chain and archive data — no private API, no platform lock-in.

## 5. Artifacts and the Artizen archive

> **Status: Live**

The **Artizen Artifacts** collection (Ethereum mainnet) is Commons' genesis collection. Each artifact is an edition minted by an Artizen project to raise funds.

What we did to make the archive usable:

- **Linked every artifact to its project.** The artifact metadata points at its Artizen project URL; we extracted that link into a `Project` trait on every asset — 176 of 180 artifacts resolved to real projects (4 tokens have unreachable metadata).
- **Linked artifacts to funds.** `Fund` traits connect each artifact to the fund(s) its project belonged to.
- **Rebuilt the registry.** All 3,375 archived projects and 258 funds exist as first-class pages with their original descriptions and taglines — including projects that never minted artifacts.
- **Fixed the images.** Original IPFS artwork is served through gateway fallbacks so cards actually paint.

Buying an artifact is the most direct way to fund its project — the sale automatically carries that project's share (see next chapter).

## 6. Where the money goes on a sale

> **Status: Live** (accounting and routing rules) · **In progress** (on-chain settlement — pools deploying)

When an artifact sells, the price splits automatically:

| Recipient | Share | Notes |
|---|---|---|
| Seller | the rest | The list price minus the shares below |
| Project behind the artifact | **0–5%** (claimed) / **10%** (unclaimed, escrowed) | Configurable by the project on claim |
| The Pot (protocol fee) | **0.5%** | Feeds the endowment forever |

**Worked example.** A $100 artifact sale for a claimed project that set 5%:

- Seller receives ~$94.50
- Project receives $5.00
- The Pot receives $0.50

If the project has not claimed yet, its 10% ($10) does not vanish — it sits in escrow at the Pot and pays out when the project claims. No sale share is ever lost to a dead project.

**How it works under the hood:** trades route through the standard royalty engine (Manifold's Royalty Registry, vendored), with a per-token royalty override contract that maps each artifact to its project's current treasury address — the Pot's escrow address until claimed. No custom trading logic was invented; the money path is entirely standard, audited ecosystem contracts.

## 7. Liquidity pools

> **Status: In progress** — contracts written and compiling, deployment pending

Beyond direct listings, Commons uses **sudoswap lssvm2** — the open-source NFT automated market maker — for pool-based liquidity:

- Anyone can create a **pool** holding NFTs + stablecoin (or ETH) for a collection.
- Pools quote prices along a **bonding curve** — a simple formula that adjusts price as supply changes.
- Buying from a pool pays the pool's spot price **plus** the project royalty and protocol fee — computed automatically at checkout.
- Royalty payment is enforced by the swap itself (lssvm2 pays the royalty recipient on every buy), so project support is not optional or off-chain.

There is no collection-token issuance: pools hold plain NFT ↔ stablecoin pairs, keeping the model legible and the risk surface small.

---

# Part III — The funding engine

## 8. The Pot

> **Status: In progress** — contract written (`CommonsPot.sol`), deploy pending

The **Pot** is Commons' endowment: a community-owned vault that only ever spends its *yield*, never its principal. Think of it as a foundation's endowment — but transparent, on-chain, and redeemable by anyone.

- **ERC-4626 hold-or-exit.** Depositing stablecoin mints you **cPOT shares** — your pro-rata claim on the vault. Hold shares while fees and yield grow them, or redeem to exit: shares burn and you take your underlying back.
- **Fees flow in without minting shares.** A `skim` function lets approved fee sources push revenue in, which grows *every existing share* rather than diluting holders.
- **Launch posture is conservative.** The vault is fully liquid and does *not* lend or farm its assets at launch — yield strategies are governance-gated and off until a bank-run analysis justifies them.
- **Admin is a Safe multisig**, not a single key. See [Governance](#19-governance) for the path away from multisig control.

The Pot also plays a second role: it is the **escrow for unclaimed project royalties**, so money earmarked for projects that have not claimed yet grows the endowment in the meantime rather than sitting idle.

## 9. Projects and claims

> **Status: Live**

A **project** is the atomic funded unit — the thing an artifact supports.

- Every archived Artizen project already has a page: description, status, artifacts, and a claim action.
- **Claiming** is signature-verified: the owner signs a message naming the project slug, treasury wallet, and chosen royalty share. No admin approves it; the signature *is* the authorization.
- **Royalty is configurable 0–5%** at claim time; unclaimed projects sit at the 10% escrowed default.
- **New projects** can be started by anyone (`/new`) — a page is created immediately and artifacts link to it as they mint.
- Creating a project earns **200 points**; claiming an Artizen project earns **1,000** (alumni recognition).

## 10. Funds and matching

> **Status: Live** (allocation logic, pledges, points-backing) · **In progress** (on-chain disbursement)

A **fund** is a curated pool of projects — like the Artizen matching funds. The 258 archived funds are live pages showing member projects, descriptions, pledges, and season points.

### Lifecycle

1. **Proposed** — anyone with ≥1,000 points can propose a fund (`/propose`), choosing its mechanism and launch goals.
2. **Activation** — a proposed fund goes Active when it hits **both** its pledge goal (dollars committed) and its points-backing goal (community endorsement). Proving demand *before* matching flows is deliberate.
3. **Active** — member pledges flow in; the fund receives its share of the season's matching.

### The three matching mechanisms

Every fund picks one (Pastry-style, implemented in a shared `matching.ts` used by both the indexer and the site):

- **Quadratic funding (QF)** — the pool is split by *how many people* back a project, not how much they give. Ten people giving $5 attract far more matching than one giving $50. Breadth beats depth.
- **Capped 1:1 match** — every contribution is matched dollar-for-dollar up to a per-donor-per-project cap.
- **Fixed multiplier** — each contribution unlocks a fixed multiple (e.g. 2×) from the pool.

In all three, if demand exceeds the pool, everything scales down proportionally — the pool can never overdraw.

You can try the math live on the `/how` page's matching sandbox.

## 11. Points and seasons

> **Status: Live** (off-chain ledger; on-chain attestation optional later)

Points are **non-transferable reputation** — they are not a token, cannot be bought, and exist for one purpose: deciding where the Pot's yield goes.

### Earning points

| Action | Points |
|---|---|
| First-ever action (welcome) | 250 |
| Per $1 pledged to a fund | 10 |
| Per $1 endowed to the Pot | 100 |
| Create a project | 200 |
| Claim an Artizen project | 1,000 |
| Propose a fund | 300 |
| Curate | 150 |

### Spending points

Each **90-day season**, members allocate points to funds on the `/allocate` page. A fund's share of all points given is its share of the season's matching. Given points are *spent* — the tally resets each season, so influence must be re-earned by continuing to participate.

Every allocation is signature-verified server-side: your wallet signs "give N points to fund F in season S", the indexer records it, and `/season` serves the live rules and totals.

### What points are deliberately not

Not transferable, not purchasable, not a claim on the Pot. They measure participation — the fairest one-person-one-influence signal we have without selling governance.

## 12. Flow funding

> **Status: In progress** — epoch computation live in the indexer, settlement via relayer next

Underneath the seasonal matching sits a finer-grained engine: **flow funding** (vendored from the MIT-licensed `naoms-flow-funding` engine), a mutual-credit-style system where value moves between participants along trust-weighted agreements.

- Each participant sets a **policy**: a floor (what they keep), a ceiling, a gradient (how fast surplus flows out above the floor), and caps per claimant and per epoch.
- Participants declare **agreements** — "I support project X" — with trust weights and formality levels.
- Every **epoch**, the engine computes each node's surplus above its floor and splits it across that node's active agreements, weighted by trust and each claimant's actual need.
- **Conservation is enforced:** if a distribution cannot satisfy the caps, the residual is refused and logged — nothing moves silently.

Today the indexer computes and records epochs (`computed` events); a Safe-authorized relayer executes the actual transfers. Next step is a bounded `FlowExecutor` contract and EAS attestations so flows are provable on-chain.

## 13. Pledges

> **Status: Live** (as signed intent; converts at settlement)

A **pledge** is a wallet-signed declaration of support — "$500 to the Africa Web3 Fund" — recorded by the indexer without moving money.

Why pledges exist:

- They **earn points immediately** (10 points per $1 pledged).
- They **prove demand** for proposed funds — a fund cannot activate without hitting its pledge goal.
- They are **free to make** — a signature, not a charge — and convert to real contributions when on-chain settlement activates.

Pledges are the on-ramp that lets the community bootstrap funds before a single dollar moves.

---

# Part IV — What is coming

*Everything in this part is designed, not yet deployed. Each chapter states its dependency honestly.*

## 14. A collateral-backed stablecoin

> **Status: Planned**

Pool trading and pledges settle in stablecoin — today that means USDC. The protocol's own settlement asset is designed next: an overcollateralized stablecoin in the lineage of Rooted Finance's **Bucky**, backed by the pool/stable reserves the marketplace generates, giving the commons a native unit of account it does not have to rent.

*Dependency: Phase B of the rooted-finance/abyayala contract tree.*

## 15. Protocol-owned liquidity

> **Status: Planned**

Rather than relying only on community LPs, the treasury itself will hold pool positions — seeding artifact markets so there is always a buyable side — with LP fees flowing to the Pot. Protocol-owned liquidity makes the flywheel self-sustaining even in quiet seasons.

## 16. Milestone verification

> **Status: Planned**

Large disbursements should not pay out on a single signature. **ImpactHook** (a Uniswap v4 hook for milestone-gated impact funding) gates releases on verified milestones — funds unlock as deliverables land. We have an open PR upstream proposing a license so the hook can be integrated properly rather than forked.

## 17. Creator tools

> **Status: Planned**

Beyond flat sales, creators get FeNXT-style primitives: **pay-per-look / watch / listen** streams, **licensing** terms attached to artifacts, **royalty splits**, **patronage** mechanics, collection **import**, and **dynamic metadata** that can evolve as milestones verify. Insurance-style protections for high-value pieces are on the same roadmap.

## 18. Data revenue

> **Status: Planned**

The indexer holds the richest public record of the post-Artizen commons: artifact metadata, project/fund registries, price and flow history. Licensed API access and premium data products become a fourth revenue stream into the Pot — aligned with, not extractive of, the community the data describes.

## 19. Governance

> **Status: Planned** (Safe multisig today → progressive decentralization)

Today a **Safe multisig** owns the Pot and factory — a deliberate launch posture, not the end state.

The path:

1. **Safe + transparent ops** (current) — every admin action is a multisig tx, visible on-chain.
2. **Points-gated proposals** — fund proposals already require 1,000 points; the same participation-weighted signal extends to parameter changes.
3. **Holon-based coordination** — funded projects organize as holons (tasks, budgets, federated decisions) via the liminalvillage/holons model.
4. **Full decentralization** — strategy modules, fee parameters, and upgrades migrate to proposal-governed execution with guardian veto.

No governance token is planned; influence flows from points and participation, not purchasable stake.

---

# Part V — Reference

## 20. Ecosystem and integrations

> **Status: Mixed**

- **aynipay / Abya Yala** — the landing experience, mutual-aid framing, and community voice are integrated into Commons (`/about`, `/how`); deeper RWA/incubator collaboration is a partner conversation.
- **Artizen** — archive preserved; PR open on `artizen-fund/artizen-frontend` inviting the community to claim its pages.
- **Pastry** (tbsoc) — matching math + points model vendored and made real; license PR open upstream.
- **Bread Cooperative** — the solidarity-fund seasonal-allocation model Commons implements; ecosystem PR open.
- **Holons** (liminalvillage) — governance/coordination layer on the roadmap; upstream-collab PR open.
- **Radicle** — planned for sovereign code hosting.
- **ImpactHook** (erinmagennis) — milestone disbursement; license PR open.

## 21. Technical annex

> **Status: Reference**

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ apps/web — Next.js 14 + Chakra + wagmi/RainbowKit         │
│   (OpenNext → Cloudflare Worker: commons-web)             │
└──────────────┬───────────────────────┬────────────────────┘
               │ GraphQL + REST        │ wallet tx/signature
┌──────────────▼──────────────┐  ┌─────▼────────────────────┐
│ workers/indexer             │  │ contracts (Foundry)      │
│  Cloudflare Worker + D1     │  │  CommonsPot (ERC-4626)   │
│  cron event indexer,        │  │  lssvm2 factory/pairs    │
│  points/pledges/funds APIs  │  │  royalty engine+override │
└──────────────┬──────────────┘  └──────────────────────────┘
               │
        vendor/upstream/naoms-flow-funding (flow epochs)
```

- **Frontend:** Liteflow starter-kit architecture (MIT-adjacent Apache-2.0) with hosted-backend dependencies replaced by open adapters to our own indexer and contracts.
- **Indexer:** Cloudflare Worker over D1 — pools, swaps, funds, claims, artifacts, points_events, point_gifts, pledges, seasons, flow policies/agreements/epochs. Cron-driven chain sync; GraphQL surface compatible with the marketplace client.
- **Contracts:** `CommonsPot` (ERC-4626, cPOT shares, `skim` fee intake, Pausable, Safe-owned); sudoswap **lssvm2** factory/pair templates; Manifold royalty registry + per-token EIP-2981 override.
- **Flows:** `naoms-flow-funding` (MIT) vendored for epoch computation.

### Security model

- **Writes are wallet-signed**: claims, pledges, point allocations, project creation, fund proposals — no bearer tokens.
- **Admin-key gating** only for indexer policy/agreement writes (`x-admin-key`).
- **Pot admin = Safe multisig**; `feeSources` allowlist controls who can push fees.
- **License policy enforced in CI**: every dependency commercially usable; `npm run loc` fails the build if custom code exceeds 5% of vendored LOC.

### Deployed surface

- Web: `commons-web.widespread.workers.dev`
- Indexer API + GraphQL: `commons-indexer.widespread.workers.dev` (`/graphql`, `/season`, `/claims`, `/funds`, `/projects/:slug`, `/points/:wallet`, `/pledges`, `/artifacts`, `/ipfs/*` fallback proxy)
- Artifacts: Ethereum mainnet `0x20cddf283164ee59742c80aa5ce9b97127f123ce`; pools/Pot target Base Sepolia → Base.

## 22. Trust assumptions and risks

> **Status: Reference**

Be clear-eyed about what you are trusting:

- **Escrow admin.** Until settlement contracts ship, escrowed royalties are accounted by the indexer and held at the Pot; the Safe multisig is the trust anchor.
- **No audits yet.** `CommonsPot` is small and standard (OpenZeppelin ERC-4626), and lssvm2 is a Spearbit-audited codebase — but our wiring has not been independently audited.
- **Testnet posture.** Pools and the Pot deploy to Base Sepolia first; nothing on this roadmap should hold value you cannot afford to lose.
- **Off-chain points.** The points ledger lives in D1 — transparent via the API, but not yet consensus-backed; attestation via EAS is the upgrade path.
- **Free-tier limits.** The web worker and indexer run on Cloudflare free tier; heavy cold starts and public-IPFS-gateway flakiness are known, mitigated with edge caching and client-side gateway fallback.

## 23. Roadmap

> **Status: Reference**

| Phase | Contents |
|---|---|
| **0 — Archive & market (done)** | Artizen archive seeded; marketplace live; trait filtering; claims; descriptions. |
| **1 — Community layer (done)** | Projects/funds pages, points, allocate, pledges, proposed-fund lifecycle, `/how` + matching sandbox. |
| **2 — Settlement** | Deploy factory/Pot to Base Sepolia; royalty sync; pools live; escrow payouts. |
| **3 — Funding engine** | FlowExecutor settlement; milestone hooks; season-end matching disbursement. |
| **4 — Monetary layer** | Stablecoin, protocol-owned liquidity, data revenue. |
| **5 — Governance** | Points-gated proposals → holons → progressive handover. |

## 24. Glossary

> **Status: Reference**

- **Artifact** — an NFT edition minted to fund a project.
- **Bonding curve** — a formula that sets a pool's price from its NFT/token balance.
- **cPOT** — the Pot's ERC-4626 share token: your redeemable claim on the endowment.
- **Claim** — signature-verified takeover of a project page by its treasury wallet.
- **Endowment** — capital that is never spent; only its yield is used.
- **Epoch** — one settlement round of the flow-funding engine.
- **Escrow** — funds held by the protocol until conditions (a claim) are met.
- **Fund** — a curated pool of projects that receives matching.
- **Hold-or-exit** — the Pot's rule: keep shares and compound, or redeem and burn.
- **Matching** — pool funds added on top of community contributions by a mechanism.
- **Mechanism** — QF, capped 1:1, or fixed multiplier.
- **NFT** — a token proving ownership of a specific digital item.
- **Pledge** — a signed intent to fund; earns points; converts at settlement.
- **Points** — non-transferable reputation spent each season to steer matching.
- **POL** — protocol-owned liquidity: pool positions held by the treasury.
- **Pool** — an lssvm2 pair holding NFTs + stablecoin quoting along a curve.
- **Quadratic funding** — matching weighted by *number of supporters*, favoring breadth.
- **Royalty** — the project's configurable share (0–5%) of every artifact sale.
- **Safe** — a multisig contract requiring several approvals per admin action.
- **Season** — a 90-day allocation round; point tallies reset between seasons.
- **Signature** — free cryptographic proof of intent, distinct from a transaction.
- **Skim** — pushing fees into the Pot without minting shares.
- **Stablecoin** — a token engineered to hold ~$1 of value.
- **Trait** — artifact metadata attribute; `Project` and `Fund` power filtering.

## 25. FAQ

> **Status: Reference**

- **Is any of this real today?** The archive, marketplace, claims, points, pledges, and matching logic are live; pool settlement and the Pot deploy next. Every chapter above is tagged.
- **Does Commons have a token?** No sale, no COMMONS token. Points are non-transferable reputation; cPOT shares are just receipts on real deposits.
- **I was on Artizen — what do I do?** Find your project under Explore → Projects, open its page, connect your treasury wallet, sign the claim.
- **What does it cost to use?** Buyers pay list price; a 0.5% protocol fee plus the project's royalty are added on top at checkout — all visible before you sign.
- **Where does the matching money come from?** The Pot's yield — funded by protocol fees, unclaimed royalties, and endowments. Principal is never spent.
- **Who runs it?** A Safe multisig stewards launch parameters; the roadmap progressively hands control to points-gated proposals and holon governance.

---

*Commons Protocol is open source (AGPL-3.0 contracts; MIT/Apache-compatible frontend). This paper is a living document — it is versioned with the code it describes.*
