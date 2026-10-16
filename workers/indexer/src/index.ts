import { createPublicClient, http, parseAbiItem, erc20Abi, formatUnits, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import {
  computeEpoch,
  runFlowSimulation,
  type FlowPolicy,
  type FlowAgreement,
  type SimHolon,
} from "./flow";

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
      await env.DB.prepare(
        "INSERT OR IGNORE INTO pools(pair,nft,nft_id,token,spot_price,delta,pool_type,owner,created_block,created_tx) VALUES(?,?,?,?,?,?,?,?,?,?)"
      )
        .bind(
          (log.args as any).poolAddress,
          "",
          null,
          null,
          null,
          null,
          log.eventName === "NewERC1155Pair" ? "1155" : "721",
          null,
          Number(log.blockNumber),
          log.transactionHash
        )
        .run();
    }
    from = to + 1n;
    await setCursor(env.DB, from);
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

    if (url.pathname === "/health") return json({ ok: true, cursor: (await getCursor(env.DB)).toString() });
    return json({ error: "not found" }, { status: 404 });
  },

  async scheduled(e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      e.cron === env.FLOW_EPOCH_CRON ? settleEpoch(env, false).then(() => undefined) : scan(env)
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
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [p.address as Address],
      });
      const dec = await client.readContract({ address: env.STABLE, abi: erc20Abi, functionName: "decimals" });
      balances.set(p.node, Number(formatUnits(bal, dec)));
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
