#!/usr/bin/env node
// Syncs claims → on-chain royalty override (EIP2981RoyaltyOverrideCloneable).
// For each artifact tokenId: recipient = claimed project wallet, else Pot
// (escrow); bps = claims.royalty_bps ?? ROYALTY_DEFAULT_BPS (10%).
//
// Env: PRIVATE_KEY (owner key for the override contract), RPC_URL,
//      OVERRIDE (override contract address), POT, INDEXER (default prod), DRY_RUN=1
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, mainnet } from "viem/chains";

const INDEXER = process.env.INDEXER ?? "https://commons-indexer.widespread.workers.dev";
const POT = process.env.POT;
const OVERRIDE = process.env.OVERRIDE;
const RPC = process.env.RPC_URL ?? "https://sepolia.base.org";
const DRY = process.env.DRY_RUN === "1";
const DEFAULT_BPS = parseInt(process.env.ROYALTY_DEFAULT_BPS ?? "1000", 10);
const CHAIN = (process.env.CHAIN_ID ?? "84532") === "1" ? mainnet : baseSepolia;

if (!OVERRIDE || !POT) {
  console.error("OVERRIDE and POT env required"); process.exit(1);
}

const abi = parseAbi([
  "struct TokenRoyaltyConfig { uint256 tokenId; address recipient; uint16 bps; }",
  "function setTokenRoyalties((uint256,address,uint16)[] royalties) external",
]);

const rows = await (await fetch(`${INDEXER}/royalty-map`)).json().catch(() => null)
  ?? null;

// Fallback: read claims + artifacts via REST endpoints when /royalty-map missing
let entries;
if (Array.isArray(rows) && rows.length) {
  entries = rows; // [{token_id, project, wallet, royalty_bps, status}]
} else {
  const arts = await (await fetch(`${INDEXER}/artifacts`)).json();
  const claims = await (await fetch(`${INDEXER}/claims`)).json();
  const byProject = new Map(claims.map((c) => [c.project, c]));
  entries = arts
    .filter((a) => a.project)
    .map((a) => ({ token_id: a.token_id, ...byProject.get(a.project) }));
}

const configs = entries.map((e) => ({
  tokenId: BigInt(e.token_id),
  recipient: (e.status === "claimed" && e.wallet ? e.wallet : POT) ,
  bps: Math.min(e.royalty_bps ?? DEFAULT_BPS, 500), // hard cap MAX_ROYALTIES 5%
}));

console.log(`syncing ${configs.length} token royalty configs (dry=${DRY})`);
if (DRY) { console.log(configs.slice(0, 5)); process.exit(0); }

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });
const BATCH = 100;
for (let i = 0; i < configs.length; i += BATCH) {
  const chunk = configs.slice(i, i + BATCH);
  const hash = await wallet.writeContract({
    address: OVERRIDE, abi, functionName: "setTokenRoyalties", args: [chunk],
  });
  console.log(`batch ${i / BATCH + 1}: ${chunk.length} configs → ${hash}`);
}
