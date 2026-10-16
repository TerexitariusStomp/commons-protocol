/**
 * GraphQL endpoint implementing the subset of the Liteflow marketplace schema
 * consumed by the apps/web documents (.gql). Data is served from D1 tables
 * populated by the event scanner + artifact census seeder.
 *
 * Model mapping:
 *   Collection  ← collections table (contracts; Artifacts = Seasons contract)
 *   Asset       ← assets table (token ids), ownerships ← balances table
 *   Offer/listing/bid ← lssvm2 pairs (pool_type TOKEN = SELL listing, NFT = BUY bid)
 *     offer id = `${chainId}-${pairAddress}`
 *   trades      ← swaps table; currencies ← currencies table
 */
import { buildSchema, graphql, parse } from "graphql";
import { readFileSync } from "./schema-sdl";

type Ctx = { env: any; viewer?: string };

const schema = buildSchema(readFileSync());

const conn = (nodes: any[], hasNext = false) => ({
  nodes,
  totalCount: nodes.length,
  pageInfo: { hasNextPage: hasNext, hasPreviousPage: false },
});

const lower = (a?: string | null) => (a || "").toLowerCase();
const offerId = (chainId: number, pair: string) => `${chainId}-${pair}`;

// Route ipfs media through our own /ipfs/ proxy (single browser origin,
// gateway fallback + edge cache server-side).
const MEDIA_ORIGIN = "https://commons-indexer.widespread.workers.dev";
const media = (u?: string | null): string | null => {
  if (!u) return u ?? null;
  const s = String(u);
  const cidPath = s.startsWith("ipfs://")
    ? s.slice(7)
    : s.includes("/ipfs/")
      ? s.slice(s.indexOf("/ipfs/") + 6)
      : null;
  if (!cidPath) return s;
  return `${MEDIA_ORIGIN}/ipfs/${cidPath}`;
};

function toAccount(row: any) {
  if (!row) return null;
  return {
    address: row.address,
    name: row.name ?? null,
    image: media(row.image),
    cover: media(row.cover),
    description: row.description ?? null,
    username: row.username ?? null,
    twitter: row.twitter ?? null,
    instagram: row.instagram ?? null,
    website: row.website ?? null,
    email: row.email ?? null,
    verification: null,
  };
}

function toCollection(row: any) {
  return {
    chainId: row.chain_id,
    address: row.address,
    name: row.name ?? "",
    image: media(row.image),
    cover: media(row.cover),
    description: row.description ?? null,
    standard: row.standard ?? "ERC1155",
    deployerAddress: row.deployer ?? "0x0000000000000000000000000000000000000000",
    deployer: { address: row.deployer ?? "0x0000000000000000000000000000000000000000" },
    numberOfOwners: row.total_owners ?? 0,
    mintType: "PUBLIC",
    totalVolume: { refCode: "USD", valueInRef: row.volume_ref ?? "0" },
    floorPrice: row.floor_price
      ? { refCode: "USD", valueInRef: row.floor_price }
      : null,
    totalSales: row.total_sales ?? 0,
    totalOwners: row.total_owners ?? 0,
    supply: parseInt(row.total_supply ?? "0", 10) || 0,
    verified: !!row.verified,
  };
}

function toAsset(row: any, ctx: Ctx) {
  return {
    chainId: row.chain_id,
    collectionAddress: row.collection_address,
    tokenId: row.token_id,
    name: row.name ?? `#${row.token_id}`,
    image: media(row.image ?? ""),
    imageMimetype: row.image_mimetype ?? null,
    animationUrl: media(row.animation_url),
    animationMimetype: row.animation_mimetype ?? null,
    quantity: row.quantity ?? "1",
    description: row.description ?? "",
    tokenUri: row.token_uri ?? null,
    createdAt: row.created_at ? new Date(row.created_at * 1000) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at * 1000) : new Date(),
    deletedAt: null,
    totalListingsCount: row.listings_count ?? 0,
    totalListingsCurrencyDistinctCount: row.listings_currency_count ?? 0,
    // nested resolvers (graphql-js calls functions on returned objects)
    collection: async (args: any, c: Ctx) => {
      const r = await (c ?? ctx).env.DB.prepare(
        "SELECT * FROM collections WHERE chain_id=? AND lower(address)=?",
      )
        .bind(row.chain_id, lower(row.collection_address))
        .first();
      return r ? toCollection(r) : null;
    },
    creator: async (_a: any, c: Ctx) => {
      const cc = c ?? ctx;
      if (!row.creator)
        return toAccount({ address: "0x0000000000000000000000000000000000000000" });
      const r = await cc.env.DB.prepare(
        "SELECT * FROM accounts WHERE lower(address)=?",
      )
        .bind(lower(row.creator))
        .first();
      return toAccount(r ?? { address: row.creator });
    },
    ownership: async (args: any, c: Ctx) => {
      const cc = c ?? ctx;
      const owner = lower(args?.ownerAddress);
      if (!owner) return null;
      const r = await cc.env.DB.prepare(
        `SELECT * FROM ownerships WHERE chain_id=? AND lower(collection_address)=?
         AND token_id=? AND lower(owner_address)=?`,
      )
        .bind(row.chain_id, lower(row.collection_address), row.token_id, owner)
        .first();
      return r ? toOwnership(r) : null;
    },
    traits: async (args: any, c: Ctx) => {
      const cc = c ?? ctx;
      const { results } = await cc.env.DB.prepare(
        `SELECT * FROM asset_traits WHERE chain_id=? AND lower(collection_address)=? AND token_id=?`,
      )
        .bind(row.chain_id, lower(row.collection_address), row.token_id)
        .all();
      return { nodes: results.map(toAssetTrait) };
    },
    royalties: async (_a: any, c: Ctx) => {
      const cc = c ?? ctx;
      // per-token: artifact → project slug → claims.royalty_bps (default 10%)
      const p = await cc.env.DB.prepare(
        `SELECT c.royalty_bps, a.project FROM artifacts a
         LEFT JOIN claims c ON c.project = a.project
         WHERE a.token_id = ?`,
      )
        .bind(row.token_id)
        .first();
      if (p?.project) return [{ value: p.royalty_bps ?? 1000 }];
      const r = await cc.env.DB.prepare(
        `SELECT value FROM royalties WHERE chain_id=? AND lower(collection_address)=?`,
      )
        .bind(row.chain_id, lower(row.collection_address))
        .first();
      return r ? [{ value: r.value }] : [];
    },
    bestListing: async (_a: any, c: Ctx) => bestOffer(row, 1, c ?? ctx),
    bestOpenOffer: async (_a: any, c: Ctx) => bestOffer(row, 2, c ?? ctx),
  };
}

async function bestOffer(assetRow: any, poolType: number, ctx: Ctx) {
  const r = await ctx.env.DB.prepare(
    `SELECT * FROM pools WHERE chain_id=? AND lower(nft)=? AND nft_id=? AND pool_type=?
     ORDER BY CAST(spot_price AS REAL) ${poolType === 1 ? "ASC" : "DESC"} LIMIT 1`,
  )
    .bind(assetRow.chain_id, lower(assetRow.collection_address), assetRow.token_id, poolType)
    .first();
  return r ? toOffer(r, ctx) : null;
}

function toOwnership(row: any) {
  return {
    ownerAddress: row.owner_address,
    owner: { address: row.owner_address ?? "0x0000000000000000000000000000000000000000" },
    quantity: row.quantity,
    asset: { chainId: row.chain_id, collectionAddress: row.collection_address, tokenId: row.token_id },
  };
}

function toAssetTrait(row: any) {
  return { type: row.type, value: row.value, collectionTraitValue: null };
}

function toOffer(row: any, ctx: Ctx) {
  return {
    id: offerId(row.chain_id ?? ctx.env.CHAIN_ID ?? 84532, row.pair),
    makerAddress: row.owner ?? "",
    takerAddressV1: null,
    type: row.pool_type === 1 ? "SALE" : "BUY",
    status: "ACTIVE",
    unitPrice: row.spot_price ?? "0",
    availableQuantity: row.nft_balance ?? "0",
    expiredAt: null,
    createdAt: row.created_block ? new Date() : new Date(),
    filledQuantity: "0",
    currency: {
      id: `${row.chain_id ?? 84532}-${row.token ?? "0x0000000000000000000000000000000000000000"}`,
      address: row.token ?? "0x0000000000000000000000000000000000000000",
      decimals: 18,
      symbol: row.token_symbol ?? "STABLE",
      name: row.token_symbol ?? "Stablecoin",
    },
    asset: row.nft_id != null
      ? { chainId: row.chain_id ?? 84532, collectionAddress: row.nft, tokenId: row.nft_id }
      : null,
    assetId: row.nft_id != null ? `${row.chain_id ?? 84532}-${row.nft}-${row.nft_id}` : null,
  };
}

function toTrade(row: any) {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const buyer = row.buyer ?? ZERO;
  const seller = row.seller ?? ZERO;
  return {
    quantity: row.nft_count ?? "0",
    buyerAddress: buyer,
    buyer: { address: buyer },
    transactionHash: row.tx ?? "0x",
    timestamp: new Date((row.ts ?? 0) * 1000),
    sellerAddress: seller,
    seller: { address: seller },
    amount: row.token_amount ?? "0",
    currency: null,
    asset: null,
  };
}

// ---------- query resolvers ----------

async function q_collections(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  let sql = "SELECT * FROM collections";
  const cond = args?.condition;
  const binds: any[] = [];
  const where: string[] = [];
  if (cond?.address) { where.push("lower(address)=?"); binds.push(lower(cond.address)); }
  if (cond?.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " LIMIT ? OFFSET ?";
  binds.push(limit + 1, offset);
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  const hasNext = results.length > limit;
  return conn(results.slice(0, limit).map(toCollection), hasNext);
}

async function q_collection(args: any, ctx: Ctx) {
  const r = await ctx.env.DB.prepare(
    "SELECT * FROM collections WHERE chain_id=? AND lower(address)=?",
  )
    .bind(args.chainId, lower(args.address))
    .first();
  return r ? toCollection(r) : null;
}

async function q_assets(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  let sql = "SELECT * FROM assets";
  const cond = args?.condition;
  const binds: any[] = [];
  const where: string[] = [];
  if (cond?.collectionAddress) {
    where.push("lower(collection_address)=?");
    binds.push(lower(cond.collectionAddress));
  }
  if (cond?.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  if (cond?.chainIds?.length) {
    where.push(`chain_id IN (${cond.chainIds.map(() => "?").join(",")})`);
    binds.push(...cond.chainIds);
  }
  if (cond?.tokenId) { where.push("token_id=?"); binds.push(String(cond.tokenId)); }
  if (cond?.creatorAddress) { where.push("lower(creator)=?"); binds.push(lower(cond.creatorAddress)); }
  if (cond?.search) {
    where.push("(lower(name) LIKE ? OR lower(description) LIKE ?)");
    const s = `%${lower(cond.search)}%`;
    binds.push(s, s);
  }
  if (cond?.traits?.length) {
    // AND across trait types, OR across values within a type
    for (const t of cond.traits as { type?: string; values?: string[] }[]) {
      if (!t?.type) continue;
      const vals = (t.values ?? []).filter(Boolean);
      const vSql = vals.length
        ? ` AND t.value IN (${vals.map(() => "?").join(",")})`
        : "";
      where.push(
        `EXISTS (SELECT 1 FROM asset_traits t WHERE t.chain_id=assets.chain_id
          AND t.collection_address=assets.collection_address
          AND t.token_id=assets.token_id AND t.type=?${vSql})`,
      );
      binds.push(t.type, ...vals);
    }
  }
  if (cond?.ids?.length) {
    // AssetIdsCondition: { chainId, collectionAddress, tokenId }
    const ors: string[] = [];
    for (const id of cond.ids as any[]) {
      const cid = typeof id === "object" && id ? id.chainId : null;
      const addr = typeof id === "object" && id ? id.collectionAddress : id;
      const tid = typeof id === "object" && id ? id.tokenId : null;
      if (cid != null && addr && tid != null) {
        ors.push("(chain_id=? AND lower(collection_address)=? AND token_id=?)");
        binds.push(parseInt(String(cid), 10), lower(String(addr)), String(tid));
      } else if (typeof id === "string") {
        const m = id.match(/^(\d+)-(0x[0-9a-fA-F]{40})-(.+)$/);
        if (m) {
          ors.push("(chain_id=? AND lower(collection_address)=? AND token_id=?)");
          binds.push(parseInt(m[1], 10), lower(m[2]), m[3]);
        }
      }
    }
    if (ors.length) where.push("(" + ors.join(" OR ") + ")");
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " LIMIT ? OFFSET ?";
  binds.push(limit + 1, offset);
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  const hasNext = results.length > limit;
  const nodes = results.slice(0, limit).map((r: any) => toAsset(r, ctx));
  return conn(nodes, hasNext);
}

async function q_asset(args: any, ctx: Ctx) {
  const r = await ctx.env.DB.prepare(
    "SELECT * FROM assets WHERE chain_id=? AND lower(collection_address)=? AND token_id=?",
  )
    .bind(args.chainId, lower(args.collectionAddress), String(args.tokenId))
    .first();
  return r ? toAsset(r, ctx) : null;
}

async function q_accounts(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM accounts LIMIT ? OFFSET ?",
  )
    .bind(limit + 1, offset)
    .all();
  return conn(results.slice(0, limit).map(toAccount), results.length > limit);
}

async function q_account(args: any, ctx: Ctx) {
  const r = await ctx.env.DB.prepare(
    "SELECT * FROM accounts WHERE lower(address)=?",
  )
    .bind(lower(args.address))
    .first();
  return r ? toAccount(r) : toAccount({ address: args.address });
}

async function q_ownerships(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  const cond = args?.condition ?? {};
  const binds: any[] = [];
  const where: string[] = [];
  if (cond.ownerAddress) { where.push("lower(owner_address)=?"); binds.push(lower(cond.ownerAddress)); }
  if (cond.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  if (cond.collectionAddress) { where.push("lower(collection_address)=?"); binds.push(lower(cond.collectionAddress)); }
  if (cond.tokenId) { where.push("token_id=?"); binds.push(String(cond.tokenId)); }
  let sql = "SELECT * FROM ownerships";
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " LIMIT ? OFFSET ?";
  binds.push(limit + 1, offset);
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  const nodes = results.slice(0, limit).map((r: any) => ({
    ownerAddress: r.owner_address,
    quantity: r.quantity,
    asset: toAssetRef(r, ctx),
    owner: { address: r.owner_address },
  }));
  return conn(nodes, results.length > limit);
}

function toAssetRef(r: any, ctx: Ctx) {
  // lazy: graphql calls nested resolvers; return an object that can resolve fields
  return {
    chainId: r.chain_id,
    collectionAddress: r.collection_address,
    tokenId: r.token_id,
    name: r.asset_name ?? `#${r.token_id}`,
    image: media(r.asset_image ?? ""),
    imageMimetype: r.asset_image_mimetype ?? null,
    animationUrl: media(r.asset_animation_url),
    collection: async (_a: any, c: Ctx) => {
      const cc = c ?? ctx;
      const row = await cc.env.DB.prepare(
        "SELECT * FROM collections WHERE chain_id=? AND lower(address)=?",
      ).bind(r.chain_id, lower(r.collection_address)).first();
      return row ? toCollection(row) : null;
    },
    creator: async (_a: any, c: Ctx) => {
      const cc = c ?? ctx;
      const row = await cc.env.DB.prepare(
        "SELECT creator FROM assets WHERE chain_id=? AND lower(collection_address)=? AND token_id=?",
      ).bind(r.chain_id, lower(r.collection_address), r.token_id).first();
      return toAccount({ address: row?.creator ?? "0x0000000000000000000000000000000000000000" });
    },
    traits: async () => ({ nodes: [] }),
  };
}

async function q_offers(args: any, ctx: Ctx, poolType: number | null) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  const cond = args?.condition ?? {};
  const binds: any[] = [];
  const where: string[] = [];
  if (poolType != null) { where.push("pool_type=?"); binds.push(poolType); }
  if (cond.makerAddress) { where.push("lower(owner)=?"); binds.push(lower(cond.makerAddress)); }
  if (cond.collectionAddress) { where.push("lower(nft)=?"); binds.push(lower(cond.collectionAddress)); }
  if (cond.tokenId) { where.push("nft_id=?"); binds.push(String(cond.tokenId)); }
  if (cond.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  let sql = "SELECT * FROM pools";
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY created_block DESC LIMIT ? OFFSET ?";
  binds.push(limit + 1, offset);
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  return conn(results.slice(0, limit).map((r: any) => toOffer(r, ctx)), results.length > limit);
}

async function q_listing(args: any, ctx: Ctx) {
  const m = String(args.id).match(/^(\d+)[-:](0x[0-9a-fA-F]{40})/);
  if (!m) return null;
  const r = await ctx.env.DB.prepare("SELECT * FROM pools WHERE lower(pair)=?")
    .bind(lower(m[2]))
    .first();
  return r ? toOffer(r, ctx) : null;
}

async function q_trades(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const offset = args?.offset ?? 0;
  const cond = args?.condition ?? {};
  const binds: any[] = [];
  const where: string[] = [];
  if (cond.buyerAddress) { where.push("lower(buyer)=?"); binds.push(lower(cond.buyerAddress)); }
  if (cond.sellerAddress) { where.push("lower(seller)=?"); binds.push(lower(cond.sellerAddress)); }
  let sql = "SELECT * FROM swaps";
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY block DESC LIMIT ? OFFSET ?";
  binds.push(limit + 1, offset);
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  return conn(results.slice(0, limit).map(toTrade), results.length > limit);
}

async function q_assetHistories(args: any, ctx: Ctx) {
  const limit = Math.min(args?.first ?? 12, 100);
  const cond = args?.condition ?? {};
  const binds: any[] = [];
  const where: string[] = [];
  if (cond.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  if (cond.collectionAddress) { where.push("lower(collection_address)=?"); binds.push(lower(cond.collectionAddress)); }
  if (cond.tokenId) { where.push("token_id=?"); binds.push(String(cond.tokenId)); }
  let sql = "SELECT * FROM asset_events";
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY block DESC LIMIT ?";
  binds.push(limit);
  try {
    const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
    return conn(results.map((r: any) => ({
      action: r.action,
      date: new Date((r.ts ?? 0) * 1000),
      unitPrice: r.unit_price ?? null,
      quantity: r.quantity ?? "1",
      fromAddress: r.from_address ?? "",
      from: { address: r.from_address ?? "" },
      toAddress: r.to_address ?? null,
      to: r.to_address ? { address: r.to_address } : null,
      transactionHash: r.tx ?? null,
      currency: null,
    })));
  } catch {
    return conn([]);
  }
}

async function q_currencies(args: any, ctx: Ctx) {
  const { results } = await ctx.env.DB.prepare("SELECT * FROM currencies").all();
  return conn(results.map((r: any) => ({
    id: `${r.chain_id}-${r.address}`,
    address: r.address,
    decimals: r.decimals,
    symbol: r.symbol,
    name: r.name,
    image: media(r.image),
  })));
}

async function q_collectionTraits(args: any, ctx: Ctx) {
  const cond = args?.condition ?? {};
  const binds: any[] = [];
  const where: string[] = [];
  if (cond.chainId) { where.push("chain_id=?"); binds.push(cond.chainId); }
  if (cond.address) { where.push("lower(collection_address)=?"); binds.push(lower(cond.address)); }
  if (cond.search) { where.push("lower(type) LIKE ?"); binds.push(`%${lower(cond.search)}%`); }
  let sql = "SELECT * FROM collection_traits";
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY type, value LIMIT 5000";
  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  // group into CollectionTrait{type, numberOfValues, values{value,count}},
  // then paginate trait *types* (first/offset apply to types, not rows)
  const grouped = new Map<string, Map<string, number>>();
  for (const r of results as any[]) {
    if (!grouped.has(r.type)) grouped.set(r.type, new Map());
    const m = grouped.get(r.type)!;
    m.set(r.value, (m.get(r.value) ?? 0) + (r.count ?? 1));
  }
  const limit = Math.min(args?.first ?? 8, 100);
  const offset = args?.offset ?? 0;
  const types = [...grouped.keys()].sort();
  return conn(
    types.slice(offset, offset + limit).map((type) => {
      const vals = grouped.get(type)!;
      return {
        type,
        numberOfValues: vals.size,
        values: conn(
          [...vals.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([value, numberOfAssets]) => ({ value, numberOfAssets })),
        ),
      };
    }),
    types.length > offset + limit,
  );
}

async function q_orderFees(args: any, ctx: Ctx) {
  // Fee is a rate per 10_000: 0.5% lssvm2 protocol + 2% marketplace (1% ops + 1% Pot) = 250
  const unitPrice = BigInt(args?.unitPrice ?? "0");
  const quantity = BigInt(args?.quantity ?? "1");
  void unitPrice; void quantity;
  return { value: "250", precision: 0 };
}

async function m_refreshAsset(_args: any, _ctx: Ctx) {
  // Metadata refresh is handled by the metadata cron; ack and move on.
  return { clientMutationId: null };
}

async function m_checkoutApprovals(args: any, ctx: Ctx) {
  // For each item, check currency allowance → router; if insufficient, return an
  // approval transaction {to, data}. ETH needs none.
  const items: { offerId: string; fillQuantity: string }[] = args?.items ?? [];
  const accountAddr = lower(args?.accountAddress);
  const { createPublicClient, http } = await import("viem");
  const { encodeFunctionData, parseAbi } = await import("viem");
  const client = createPublicClient({
    transport: http(ctx.env.RPC_URL),
  });
  const router = ctx.env.ROUTER;
  const byCcy = new Map<string, bigint>();
  for (const it of items) {
    const m = String(it.offerId ?? "").match(/^(\d+)[-:](0x[0-9a-fA-F]{40})/);
    if (!m) continue;
    const pool = await ctx.env.DB.prepare("SELECT * FROM pools WHERE lower(pair)=?")
      .bind(lower(m[2])).first();
    if (!pool) continue;
    const ccy = pool.token ?? "0x0000000000000000000000000000000000000000";
    let cost = BigInt(pool.spot_price ?? "0") * BigInt(it.fillQuantity || "1");
    // Buyer pays royalty + 0.5% protocol fee on top of spot — allowance must cover it.
    const roy = await ctx.env.DB.prepare(
      `SELECT c.royalty_bps FROM artifacts a
       LEFT JOIN claims c ON c.project = a.project WHERE a.token_id = ?`,
    )
      .bind(pool.nft_id ?? "")
      .first();
    const bps = BigInt(roy?.royalty_bps ?? 1000) + 50n;
    cost += (cost * bps) / 10000n;
    byCcy.set(ccy, (byCcy.get(ccy) ?? 0n) + cost);
  }
  const out: any[] = [];
  for (const [ccy, amount] of byCcy) {
    let needsApproval = false;
    if (ccy !== "0x0000000000000000000000000000000000000000" && router) {
      try {
        const allowance = (await client.readContract({
          address: ccy as `0x${string}`,
          abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
          functionName: "allowance",
          args: [accountAddr as `0x${string}`, router],
        })) as bigint;
        needsApproval = allowance < amount;
      } catch { needsApproval = true; }
    }
    out.push({
      currency: { id: `${ctx.env.CHAIN_ID ?? 84532}-${ccy}`, address: ccy, decimals: 18, symbol: "TOKEN", name: "Token" },
      amount: amount.toString(),
      transaction: needsApproval
        ? {
            to: ccy,
            data: encodeFunctionData({
              abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
              functionName: "approve",
              args: [router, amount],
            }),
            value: "0",
            from: accountAddr,
          }
        : null,
    });
  }
  return out;
}

// ---------- entry ----------

const root = {
  collections: q_collections,
  collection: q_collection,
  assets: q_assets,
  asset: q_asset,
  accounts: q_accounts,
  account: q_account,
  ownerships: q_ownerships,
  listings: (a: any, c: Ctx) => q_offers(a, c, 1),
  openOffers: (a: any, c: Ctx) => q_offers(a, c, 2),
  offers: (a: any, c: Ctx) => q_offers(a, c, null),
  listing: q_listing,
  trades: q_trades,
  assetHistories: q_assetHistories,
  currencies: q_currencies,
  collectionTraits: q_collectionTraits,
  orderFees: q_orderFees,
  drops: async () => conn([]),
  notifications: async () => conn([]),
  config: async (_a: any, c: Ctx) => ({
    name: c.env.MARKETPLACE_NAME ?? "Commons",
    hasLazyMint: false,
    offerValiditySeconds: 28 * 24 * 3600,
  }),
  refreshAsset: m_refreshAsset,
  createCheckoutApprovalTransactions: m_checkoutApprovals,
};

export async function handleGraphQL(req: Request, env: any): Promise<Response> {
  const body = (await req.json()) as { query: string; variables?: any; operationName?: string };
  try {
    parse(body.query); // cheap syntax check; invalid docs error early
  } catch (e) {
    return new Response(JSON.stringify({ errors: [{ message: (e as Error).message }] }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  // graphql-js defaultFieldResolver calls root functions as (args, contextValue, info)
  const res = await graphql({
    schema,
    source: body.query,
    rootValue: root as any,
    contextValue: { env } satisfies Ctx,
    variableValues: body.variables,
    operationName: body.operationName,
  });
  return new Response(JSON.stringify(res), {
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
