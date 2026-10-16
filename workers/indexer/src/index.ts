import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { baseSepolia } from "viem/chains";

export interface Env {
  DB: D1Database;
  RPC_URL: string;
  FACTORY: Address;
  POT: Address;
  START_BLOCK: string;
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
    if (url.pathname === "/health") return json({ ok: true, cursor: (await getCursor(env.DB)).toString() });
    return json({ error: "not found" }, { status: 404 });
  },

  async scheduled(_e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(scan(env));
  },
};
