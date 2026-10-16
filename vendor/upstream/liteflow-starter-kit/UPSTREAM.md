# liteflow-labs/starter-kit

- Upstream: https://github.com/liteflow-labs/starter-kit
- Pinned commit: 4e44ddf1ba4c0b0d03ba6a9ef9863087aee59f19
- License: Apache-2.0 (LICENSE)
- Vendored: pristine copy for reference + upstream diffing.

`apps/web` is our adapted fork. Integration deltas kept minimal:
unlicensed @nft/* and @liteflow/react SDK deps are replaced by local
implementations (apps/web/src/liteflow), and the GraphQL endpoint is
served by workers/indexer over our own D1 data. Track upstream changes
by diffing against this tree.
