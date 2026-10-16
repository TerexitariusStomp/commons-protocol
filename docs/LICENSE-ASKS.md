# License asks — draft messages to send

Status: PRs opened 2026-10 — pastry#1, artizenal#1, ImpactHook#1,
artizen-fyi#13. Ecosystem/collab PRs: starter-kit#624, lssvm2#4,
holons#73, artizen-frontend#696, solidarity-fund#211, aynipay-website#1.

## 1. tbsoc/pastry → Bread Cooperative team

> Hey — we're building the post-Artizen public-goods marketplace protocol
> (working name Commons Protocol) that integrates and improves Pastry:
> real contract bindings behind your store.tsx, your matching.ts math on-chain,
> and the artifact/rescue pages as the flagship use case.
>
> The repo currently has no license file, which technically makes it
> all-rights-reserved despite being public. Could you add a license?
> MIT would be ideal; AGPL/GPL also work for us (copyleft is fine —
> our stack is AGPL). We'll upstream our improvements as PRs
> (store→wagmi bindings, matching refinements) rather than forking.
>
> Meanwhile we'll treat the code as fork-with-permission for the collab —
> let us know if you'd rather we hold off touching it until licensed.

## 2. erinmagennis/ImpactHook → Erin Magennis

> Hey Erin — integrating ImpactHook into the post-Artizen funding protocol
> (milestone-gated LP-fee funding for impact projects). Your hook is exactly
> the disbursement primitive we need. The repo has no LICENSE file —
> could you add one (MIT or AGPL both fine for us)? Until then we're
> integrating strictly by deployed-contract address + published interface,
> no vendored code. Happy to upstream any hook features we need as PRs.

## 3. Uniswap v4-core — verify license state

- v4-core is BUSL-1.1 historically with an LCL (Limited Commercial License)
  exception window; check current terms + whether community-deployed v4
  already covers our use (call deployed singleton — integration, not deploy).
- Action: verify at github.com/Uniswap/v4-core LICENSE file.

## 4. Reservoir — verify core contract license

- SDK (relay-kit) is MIT; core contract repo license unverified.
- Integration path already API/SDK-only; license ask optional unless we
  want to self-deploy their order protocol.

## 5. Human Passport (passportxyz) — verify license (NOASSERTION on GitHub API)

- Needed only if we add Passport-based sybil resistance (Octant uses it).
- Action: check LICENSE in passport-scorer / passport repos before adopting.

## Not needed

- Anvil (BUSL-1.1): aggregate-only by design, no ask required unless we
  want a partnership (possible: they earn 50bps protocol fee on volume we
  route — leverage for cross-promotion, not code).
- artizen-fyi (unlicensed): not integrated — our own artizen-public archive
  + on-chain census is the data source.
