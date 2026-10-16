import { createPublicClient, http, parseAbiItem, formatUnits, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import {
  computeEpoch,
  runFlowSimulation,
  type FlowPolicy,
  type FlowAgreement,
  type SimHolon,
} from "./flow";
import { handleGraphQL } from "./graphql";

export interface Env {
  DB: D1Database;
  RPC_URL: string;
  FACTORY: Address;
  POT: Address;
  START_BLOCK: string;
  STABLE: Address; // settlement stable for flow balance reads
  ADMIN_KEY: string; // shared secret gating policy/agreement writes (header x-admin-key)
  FLOW_EPOCH_CRON: string; // cron expr that triggers epoch settlement, e.g. "5 0 * * *"
}

const FACTORY_EVENTS = [
  parseAbiItem("event NewERC721Pair(address poolAddress, uint256[] initialNFTBalance)"),
  parseAbiItem("event NewERC1155Pair(address poolAddress, uint256 initialNFTBalance)"),
];

const PAIR_READ_ABI = [
  "function nft() view returns (address)",
  "function token() view returns (address)",
  "function spotPrice() view returns (uint128)",
  "function delta() view returns (uint128)",
  "function poolType() view returns (uint8)",
  "function assetRecipient() view returns (address)",
  "function nftId() view returns (uint256)",
] as const;

// enrich a newly-seen pair with its on-chain fields (nft, token, spot, owner…)
async function enrichPair(env: Env, client: any, pair: Address, erc1155: boolean) {
  const read = async (fn: string) =>
    client.readContract({ address: pair, abi: PAIR_READ_ABI, functionName: fn as any });
  const [nft, poolTypeRaw, spot, delta, owner] = await Promise.all([
    read("nft").catch(() => null),
    read("poolType").catch(() => null),
    read("spotPrice").catch(() => null),
    read("delta").catch(() => null),
    read("assetRecipient").catch(() => null),
  ]);
  let token: string | null = null;
  try { token = (await read("token")) as string; } catch { /* ETH pair */ }
  const nftId = erc1155 ? String((await read("nftId").catch(() => null)) ?? "0") : null;
  const poolTypeNum = poolTypeRaw == null ? null : Number(poolTypeRaw);
  await env.DB.prepare(
    `UPDATE pools SET nft=?, nft_id=?, token=?, spot_price=?, delta=?, pool_type=?, owner=? WHERE lower(pair)=?`
  )
    .bind(
      nft ? String(nft).toLowerCase() : "",
      nftId,
      token ? String(token).toLowerCase() : null,
      spot != null ? String(spot) : null,
      delta != null ? String(delta) : null,
      poolTypeNum != null ? String(poolTypeNum) : null,
      owner ? String(owner).toLowerCase() : null,
      pair.toLowerCase()
    )
    .run();
}

const PAGE = 40_000n;

async function getCursor(db: D1Database): Promise<bigint> {
  const row = await db.prepare("SELECT value FROM state WHERE key='cursor'").first<{ value: string }>();
  return BigInt(row?.value ?? "0");
}

async function setCursor(db: D1Database, v: bigint) {
  await db.prepare("INSERT INTO state(key,value) VALUES('cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(v.toString())
    .run();
}

async function scan(env: Env) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(env.RPC_URL) });
  let from = await getCursor(env.DB);
  if (from === 0n) from = BigInt(env.START_BLOCK || "0");
  const head = await client.getBlockNumber();
  while (from <= head) {
    const to = from + PAGE > head ? head : from + PAGE;
    const logs = await client.getLogs({
      address: env.FACTORY as Address,
      events: FACTORY_EVENTS,
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const pair = (log.args as any).poolAddress as Address;
      const erc1155 = log.eventName === "NewERC1155Pair";
      await env.DB.prepare(
        "INSERT OR IGNORE INTO pools(pair,chain_id,nft,pool_type,created_block,created_tx) VALUES(?,?,?,?,?,?)"
      )
        .bind(pair, 84532, "", null, Number(log.blockNumber), log.transactionHash)
        .run();
      await enrichPair(env, client, pair, erc1155);
    }
    from = to + 1n;
    await setCursor(env.DB, from);
  }
}

// Hydrate asset metadata (name/image/animation) from token_uri JSON.
// Batches a few per cron run; ipfs:// is gatewayed via ipfs.io.
const IPFS_GW = "https://ipfs.io/ipfs/";
async function hydrateMetadata(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT chain_id, collection_address, token_id, token_uri FROM assets WHERE (image IS NULL OR image='') AND token_uri IS NOT NULL AND token_uri!='' LIMIT 10"
  ).all();
  for (const r of results as any[]) {
    try {
      const uri = String(r.token_uri).replace(/^ipfs:\/\//, IPFS_GW);
      const res = await fetch(uri, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const meta = (await res.json()) as any;
      const image = meta.image ?? meta.image_url ?? "";
      const anim = meta.animation_url ?? null;
      await env.DB.prepare(
        "UPDATE assets SET name=COALESCE(NULLIF(?,''),name), image=?, animation_url=?, description=COALESCE(NULLIF(?,''),description), updated_at=unixepoch() WHERE chain_id=? AND collection_address=? AND token_id=?"
      )
        .bind(
          String(meta.name ?? ""),
          image ? String(image).replace(/^ipfs:\/\//, IPFS_GW) : "",
          anim ? String(anim).replace(/^ipfs:\/\//, IPFS_GW) : null,
          String(meta.description ?? ""),
          r.chain_id,
          r.collection_address,
          r.token_id
        )
        .run();
      if (Array.isArray(meta.attributes)) {
        for (const t of meta.attributes) {
          if (!t?.trait_type) continue;
          await env.DB.prepare(
            "INSERT OR REPLACE INTO asset_traits(chain_id,collection_address,token_id,type,value) VALUES(?,?,?,?,?)"
          )
            .bind(r.chain_id, r.collection_address, r.token_id, String(t.trait_type), String(t.value ?? ""))
            .run();
        }
      }
    } catch { /* bad uri/host — leave for next pass */ }
  }
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/pools") {
      const { results } = await env.DB.prepare("SELECT * FROM pools ORDER BY created_block DESC").all();
      return json(results);
    }
    if (url.pathname.startsWith("/pools/")) {
      const pair = url.pathname.split("/")[2].toLowerCase();
      const pool = await env.DB.prepare("SELECT * FROM pools WHERE lower(pair)=?").bind(pair).first();
      return json(pool ?? {}, { status: pool ? 200 : 404 });
    }
    if (url.pathname === "/funds") {
      const { results } = await env.DB.prepare("SELECT * FROM funds").all();
      return json(results);
    }
    if (url.pathname === "/claims") {
      const wallet = url.searchParams.get("wallet");
      const { results } = wallet
        ? await env.DB.prepare("SELECT * FROM claims WHERE lower(wallet)=?").bind(wallet.toLowerCase()).all()
        : await env.DB.prepare("SELECT * FROM claims").all();
      return json(results);
    }
    if (url.pathname === "/artifacts") {
      const { results } = await env.DB.prepare("SELECT * FROM artifacts").all();
      return json(results);
    }

    // ---- flow funding ----
    if (url.pathname === "/flow/policies") {
      if (req.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM flow_policies").all();
        return json(results);
      }
      if (req.method === "POST" && authed(req, env)) {
        const p = (await req.json()) as Partial<FlowPolicy>;
        if (!p.node || p.floor == null || p.ceiling == null)
          return json({ error: "node, floor, ceiling required" }, { status: 400 });
        await env.DB.prepare(
          `INSERT OR REPLACE INTO flow_policies
           (node,address,floor,ceiling,gradient,per_claimant_cap,per_epoch_cap,denomination,enabled,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch())`
        )
          .bind(
            p.node, p.address ?? "", p.floor, p.ceiling,
            p.gradient ?? 0, p.perClaimantCap ?? 0.34, p.perEpochCap ?? 0.1,
            p.denomination ?? "stable", p.enabled === 0 ? 0 : 1
          )
          .run();
        return json({ ok: true });
      }
    }
    if (url.pathname === "/flow/agreements") {
      if (req.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM flow_agreements").all();
        return json(results);
      }
      if (req.method === "POST" && authed(req, env)) {
        const a = (await req.json()) as Partial<FlowAgreement> & { from?: string };
        if (!a.from || !a.to) return json({ error: "from, to required" }, { status: 400 });
        const id = a.id ?? crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO flow_agreements
           (id,from_node,to_node,trust_weight,formality,tier,share_pct,expires_at,status,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?, 'proposed', unixepoch(), unixepoch())`
        )
          .bind(id, a.from, a.to, a.trustWeight ?? 1, a.formality ?? 0, a.tier ?? "relational",
                (a as Record<string, unknown>).sharePct as number ?? null, (a as Record<string, unknown>).expiresAt as number ?? null)
          .run();
        return json({ ok: true, id });
      }
    }
    const agreeMatch = url.pathname.match(/^\/flow\/agreements\/([^/]+)\/(accept|revoke)$/);
    if (agreeMatch && req.method === "POST" && authed(req, env)) {
      const status = agreeMatch[2] === "accept" ? "active" : "revoked";
      await env.DB.prepare("UPDATE flow_agreements SET status=?, updated_at=unixepoch() WHERE id=?")
        .bind(status, agreeMatch[1])
        .run();
      return json({ ok: true, status });
    }
    if (url.pathname === "/flow/simulate" && req.method === "POST") {
      const body = (await req.json()) as { holons: SimHolon[]; epochs?: number };
      if (!Array.isArray(body.holons)) return json({ error: "holons[] required" }, { status: 400 });
      return json(runFlowSimulation(body.holons, { epochs: body.epochs ?? 12 }));
    }
    if (url.pathname === "/flow/events") {
      const { results } = await env.DB.prepare("SELECT * FROM flow_events ORDER BY id DESC LIMIT 500").all();
      return json(results);
    }
    if (url.pathname === "/flow/epoch" && req.method === "POST" && authed(req, env)) {
      // dry-run: compute + record computed events, no settlement
      return json(await settleEpoch(env, false));
    }

    // ---- marketplace graphql (liteflow-compatible subset) ----
    if (url.pathname === "/graphql" && req.method === "POST") {
      return handleGraphQL(req, env);
    }
    if (url.pathname === "/graphql" && req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
        },
      });
    }

    // ---- auth (SIWE-lite) ----
    if (url.pathname === "/auth/nonce" && req.method === "POST") {
      const { address } = (await req.json()) as { address: string };
      const nonce = crypto.randomUUID();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const message = `Commons wants you to sign in.\n\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
      await env.DB.prepare(
        "INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(`nonce:${address.toLowerCase()}`, JSON.stringify({ nonce, exp })).run();
      return json({ message });
    }
    if (url.pathname === "/auth/verify" && req.method === "POST") {
      const { address, message, signature } = (await req.json()) as {
        address: string; message: string; signature: string;
      };
      try {
        const { verifyMessage } = await import("viem");
        const ok = await verifyMessage({ address: address as Address, message, signature: signature as `0x${string}` });
        if (!ok) return json({ error: "bad signature" }, { status: 401 });
      } catch {
        return json({ error: "verification failed" }, { status: 401 });
      }
      const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
      // unsigned-jwt-style token: payload only, gated by signature verification above
      const payload = btoa(JSON.stringify({ address: address.toLowerCase(), exp }));
      const token = `${btoa('{"alg":"none"}')}.${payload}.commons`;
      return json({ token });
    }

    // ---- pool inventory (nftIds held by a pair, for router buy calls) ----
    if (url.pathname === "/pool/inventory" && req.method === "POST") {
      const { pair, count } = (await req.json()) as { chainId: number; pair: string; count: number };
      const { results } = await env.DB.prepare(
        "SELECT nft_id FROM pool_inventory WHERE lower(pair)=? LIMIT ?"
      ).bind((pair || "").toLowerCase(), count ?? 1).all<{ nft_id: string }>();
      return json({ ids: results.map((r) => r.nft_id) });
    }

    // ---- accounts / invitations ----
    if (url.pathname === "/accounts" && req.method === "POST") {
      const a = (await req.json()) as Record<string, string>;
      if (!a.address) return json({ error: "address required" }, { status: 400 });
      await env.DB.prepare(
        `INSERT INTO accounts(address,name,username,description,twitter,instagram,website,image,cover)
         VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(address) DO UPDATE SET name=excluded.name, username=excluded.username,
           description=excluded.description, twitter=excluded.twitter, instagram=excluded.instagram,
           website=excluded.website, image=excluded.image, cover=excluded.cover`
      ).bind(
        a.address.toLowerCase(), a.name ?? null, a.username ?? null, a.description ?? null,
        a.twitter ?? null, a.instagram ?? null, a.website ?? null, a.image ?? null, a.cover ?? null
      ).run();
      return json({ address: a.address.toLowerCase() });
    }
    if (url.pathname === "/invitations" && req.method === "POST") {
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO state(key,value) VALUES(?,?)").bind(`invite:${id}`, "open").run();
      return json({ id });
    }
    const invMatch = url.pathname.match(/^\/invitations\/([^/]+)\/accept$/);
    if (invMatch && req.method === "POST") {
      await env.DB.prepare("UPDATE state SET value='accepted' WHERE key=?").bind(`invite:${invMatch[1]}`).run();
      return json({ ok: true });
    }

    if (url.pathname === "/health") return json({ ok: true, cursor: (await getCursor(env.DB)).toString() });
    return json({ error: "not found" }, { status: 404 });
  },

  async scheduled(e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      e.cron === env.FLOW_EPOCH_CRON
        ? settleEpoch(env, false).then(() => undefined)
        : scan(env).then(() => hydrateMetadata(env))
    );
  },
};

function authed(req: Request, env: Env): boolean {
  return !!env.ADMIN_KEY && req.headers.get("x-admin-key") === env.ADMIN_KEY;
}

async function settleEpoch(env: Env, settleOnchain: boolean) {
  const [{ results: policies }, { results: agreements }] = await Promise.all([
    env.DB.prepare("SELECT * FROM flow_policies WHERE enabled=1").all<FlowPolicy>(),
    env.DB.prepare("SELECT * FROM flow_agreements WHERE status='active'").all<FlowAgreement>(),
  ]);
  // flow_agreements stores from_node/to_node; map into adapter's from/to shape
  const edges = (agreements as unknown as Record<string, unknown>[]).map((a) => ({
    id: a.id as string,
    from: a.from_node as string,
    to: a.to_node as string,
    trustWeight: (a.trust_weight as number) ?? 1,
    formality: (a.formality as number) ?? 0,
    tier: (a.tier as string) ?? "relational",
    status: (a.status as string) ?? "proposed",
  }));

  // read on-chain stable balances for each policy address
  const client = createPublicClient({ chain: baseSepolia, transport: http(env.RPC_URL) });
  const balances = new Map<string, number>();
  for (const p of policies as unknown as FlowPolicy[]) {
    if (!p.address) { balances.set(p.node, 0); continue; }
    try {
      const bal = await client.readContract({
        address: env.STABLE,
        abi: ["function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)"] as const,
        functionName: "balanceOf",
        args: [p.address as Address],
      });
      const dec = await client.readContract({ address: env.STABLE, abi: ["function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)"] as const, functionName: "decimals" });
      balances.set(p.node, Number(formatUnits(bal as bigint, dec as number)));
    } catch {
      balances.set(p.node, 0);
    }
  }

  const epoch = Math.floor(Date.now() / 86_400_000);
  const result = computeEpoch(epoch, policies as unknown as FlowPolicy[], edges, balances);

  for (const leg of result.legs) {
    await env.DB.prepare(
      "INSERT INTO flow_events(epoch,from_node,to_node,amount,status) VALUES(?,?,?,?,'computed')"
    )
      .bind(result.epoch, leg.from, leg.to, leg.amount)
      .run();
  }
  // settleOnchain: relayer execution lands here (Safe-authorized key, v1 records only)
  void settleOnchain;
  return result;
}
