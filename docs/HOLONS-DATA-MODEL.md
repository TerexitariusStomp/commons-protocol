# Artizen → Holons data model

Per the Artizen Fork Proposal (9 Oct 2026): Pot → Funds → Projects → People → Resources.

## Mapping

| Artizen source | Holons entity | On-chain anchor |
|---|---|---|
| Treasury / donor pool | **Pot** holon | ERC-4626 vault (Pot shares); address in metadata |
| Curated fund (Season fund, thematic fund) | **Fund** holon (parent=Pot) | per-fund mechanism config in `match` contract |
| Artizen project (archive slug) | **Project** holon (parent=Fund(s)) | collection page `/collection/{slug}` + rescue-share merkle leaf |
| Creator/patron wallet or Telegram user | **People** holon | wallet-link EAS attestation → points |
| Artifact tokenIds, media, tools | **Resource** edges on Project | ERC-1155 tokenIds from census |

## Edges

- `funds` (Pot→Fund→Project): historical + live funding events
- `holds` (Person→Artifact/Resource): census holder edges → patronage points
- `issued` (Project→Resource): project→artifact tokenIds (census join)
- `supports` (Person→Project/Fund): donations, pool LPs, marketplace buys
- `returns` (Project→Fund/Pot): backflow — pool fee skims, milestone repayments

## Claim flow (consent by design)

1. Project holon pre-seeded from archive slug (name, media, funding history, artifact tokenIds).
2. Project adds `@HolonsBot` (or our CF-Worker bot) to their Telegram group → `/claim` links a wallet.
3. Worker verifies Telegram admin status → writes EAS attestation {projectSlug, wallet, tgChatId} → claims the merkle-reserved pot share + collection-page ownership.
4. Window: 6 months from launch. Unclaimed shares → Pot redistribution (equal split or per governance).

## Impact roll-up

Fund impact = Σ(project impact) weighted by funding share; Pot impact = Σ(fund impact). Stored as computed views, event-sourced — never a netting primitive.
