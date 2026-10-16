#!/usr/bin/env node
// Census the Artizen Seasons ERC-1155 (0x20CdDf...123cE) on Ethereum mainnet:
// scan TransferSingle + TransferBatch, aggregate per-tokenId holders/balances,
// resolve token URIs -> metadata -> project join against archived slugs.
// Output: docs/census-artifacts.json + .md summary. No deps — fetch + JSON-RPC.
//
// Usage: node scripts/census-artifacts.mjs [--from N] [--to N] [--rpc URL]
import fs from "node:fs";
import path from "node:path";

const RPC = process.env.ETH_RPC || "https://ethereum-rpc.publicnode.com";
const CONTRACT = "0x20cdd f283164ee59742c80aa5ce9b97127f123ce".replace(/ /g, "").toLowerCase();
const T_SINGLE = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"; // TransferSingle
const T_BATCH = "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb"; // TransferBatch
const ZERO = "0x0000000000000000000000000000000000000000";
const ARCHIVE = "/home/terex/Documents/artizen-public/archive/projects";
const OUT = path.resolve(import.meta.dirname, "../docs");

const args = Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith("--")).map(a=>{const[k,v]=a.slice(2).split("=");return[k,v??true]}));

async function rpc(method, params, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { if (i === retries - 1) throw e; await new Promise(r => setTimeout(r, 800 * 2 ** i)); }
  }
}

const hex = (n) => "0x" + n.toString(16);
const fromHex = (h) => BigInt(h);
const addr = (t) => "0x" + t.slice(-40).toLowerCase();

async function getLogs(from, to, topics) {
  return rpc("eth_getLogs", [{ address: CONTRACT, fromBlock: hex(from), toBlock: hex(to), topics }]);
}

async function main() {
  const latest = parseInt(await rpc("eth_blockNumber", []), 16);
  // find first TransferSingle by exponential-probe binary search on logs
  let lo = 10_000_000, hi = latest;
  let first = null;
  // probe: contract deployed ~S1 mid-2023 (~block 17M). Binary search for first log.
  for (let i = 0; i < 30; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const logs = await getLogs(10_000_000, mid, [T_SINGLE]).catch(() => null);
    const has = logs && logs.length > 0;
    console.error(`probe <=${mid}: ${has ? logs.length : 0} single events`);
    if (has) { hi = mid; first = mid; } else lo = mid;
    if (hi - lo < 10_000) break;
  }
  const start = args.from ? parseInt(args.from) : Math.max(0, (lo) - 100_000);
  const end = args.to ? parseInt(args.to) : latest;
  console.error(`scanning ${start}..${end}`);

  // balances[tokenId][holder] = balance
  const balances = new Map();
  const seenTx = new Set();
  const CHUNK = 40_000;

  // TransferSingle topics: [sig, operator, from, to]; data = id ++ value
  function applySingle(l) {
    seenTx.add(l.transactionHash);
    const from = addr(l.topics[2]); const to = addr(l.topics[3]);
    const idv = BigInt("0x" + l.data.slice(2, 66)).toString();
    const v = BigInt("0x" + l.data.slice(66, 130));
    add(balances, idv, to, v); add(balances, idv, from, -v);
  }

  // TransferBatch topics: [sig, operator, from, to]; data = [idsOff, valsOff, nIds, ids.., nVals, vals..]
  function applyBatch(l) {
    seenTx.add(l.transactionHash);
    const from = addr(l.topics[2]); const to = addr(l.topics[3]);
    const d = l.data.slice(2);
    const idsOff = parseInt(d.slice(0, 64), 16) * 2; const valsOff = parseInt(d.slice(64, 128), 16) * 2;
    const nIds = parseInt(d.slice(idsOff, idsOff + 64), 16);
    const nVals = parseInt(d.slice(valsOff, valsOff + 64), 16);
    for (let i = 0; i < nIds; i++) {
      const id = BigInt("0x" + d.slice(idsOff + 64 * (i + 1), idsOff + 64 * (i + 2))).toString();
      const v = BigInt("0x" + d.slice(valsOff + 64 * (i + 1), valsOff + 64 * (i + 2)));
      add(balances, id, to, v); add(balances, id, from, -v);
    }
  }

  // fetch a window, splitting recursively on RPC errors; depth-bounded
  async function scanWindow(f, t, depth = 0) {
    if (f > t) return;
    let singles, batches;
    try {
      singles = await getLogs(f, t, [T_SINGLE]);
      batches = await getLogs(f, t, [T_BATCH]);
    } catch (e) {
      if (depth >= 6) { console.error(`DROPPED ${f}-${t}: ${e.message}`); return; }
      const mid = Math.floor((f + t) / 2);
      await new Promise((r) => setTimeout(r, 400));
      await scanWindow(f, mid, depth + 1);
      await scanWindow(mid + 1, t, depth + 1);
      return;
    }
    singles.forEach(applySingle);
    batches.forEach(applyBatch);
  }

  for (let f = start; f <= end; f += CHUNK) {
    const t = Math.min(f + CHUNK - 1, end);
    await scanWindow(f, t);
    if ((f - start) / CHUNK % 25 === 0) console.error(`${f}..${t}: ${seenTx.size} txs, ${balances.size} ids`);
  }

  // resolve uri() for each id (skip zero-balance ids) and fetch metadata
  const report = {};
  const minted = [...balances.entries()].filter(([,m]) => [...m.values()].some(v=>v>0n));
  console.error(`${minted.length} live tokenIds`);
  const slugs = fs.existsSync(ARCHIVE) ? new Set(fs.readdirSync(ARCHIVE).filter(f=>f.endsWith(".html")).map(f=>f.slice(0,-5))) : new Set();
  for (const [id, holders] of minted) {
    const hs = [...holders.entries()].filter(([a,b]) => b > 0n && a !== ZERO)
      .map(([a,b]) => [a, b.toString()]);
    let uri = null, meta = null;
    try {
      uri = await rpc("eth_call", [{ to: CONTRACT, data: "0x0e89341c" + BigInt(id).toString(16).padStart(64, "0") }, "latest"]);
      uri = decodeString(uri);
      if (uri && uri.startsWith("ipfs://")) uri = "https://ipfs.io/ipfs/" + uri.slice(7);
      if (uri) { const r = await fetch(uri); if (r.ok) meta = await r.json(); }
    } catch {}
    const slugGuess = meta ? guessSlug(meta, slugs) : null;
    report[id] = { holders: hs, uri, name: meta?.name, project: slugGuess };
    await new Promise(r=>setTimeout(r, 40));
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "census-artifacts.json"), JSON.stringify(report, null, 1));
  const totalHolders = new Set(Object.values(report).flatMap(r => r.holders.map(h=>h[0]))).size;
  console.error(`done: ${Object.keys(report).length} tokenIds, ${totalHolders} unique holders → docs/census-artifacts.json`);
}

function add(bal, id, a, v) {
  if (a === ZERO) return;
  if (!bal.has(id)) bal.set(id, new Map());
  const m = bal.get(id); m.set(a, (m.get(a) || 0n) + v);
}
function decodeString(hexData) {
  const d = hexData.slice(2); const off = parseInt(d.slice(0,64),16)*2; const len = parseInt(d.slice(off, off+64),16);
  return Buffer.from(d.slice(off+64, off+64+len*2), "hex").toString();
}
function guessSlug(meta, slugs) {
  const name = (meta.name||"").toLowerCase();
  const proj = meta.project || meta.projectName || meta.properties?.project;
  for (const cand of [proj, name]) if (cand && slugs.has(slugify(cand))) return slugify(cand);
  for (const s of slugs) if (name && s.toLowerCase().split("-").filter(w=>w.length>3).every(w=>name.includes(w))) return s;
  return null;
}
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

main().catch(e => { console.error(e); process.exit(1); });
