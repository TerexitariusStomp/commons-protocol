#!/usr/bin/env node
// Links artifacts → Artizen project (external_url slug) → Artizen funds.
// Emits idempotent SQL to stdout; apply with:
//   wrangler d1 execute commons-index --remote --config workers/indexer/wrangler.toml --file out.sql --yes
import fs from "node:fs";
import path from "node:path";

const CENSUS = "docs/census-artifacts.json";
const PROJECTS_JSON = "/home/terex/Documents/artizen-public/archive/projects.json";
const FUNDS_DIR = "/home/terex/Documents/artizen-public/archive/funds";
const CONTRACT = "0x20cddf283164ee59742c80aa5ce9b97127f123ce";
const CHAIN = 1;
const GWS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://nftstorage.link/ipfs/",
];
const esc = (s) => "'" + String(s).replace(/[\r\n]+/g, " ").replace(/'/g, "''") + "'";
const httpUrl = (u) => (u ?? "").replace(/^ipfs:\/\//, GWS[0]);

// slug → display name
const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf8"));
const nameBySlug = new Map(projects.map((p) => [p.slug, p.name]));

// fund slug → {name, member slugs}
const fundMembers = new Map();
for (const f of fs.readdirSync(FUNDS_DIR)) {
  if (!f.endsWith(".html")) continue;
  const html = fs.readFileSync(path.join(FUNDS_DIR, f), "utf8");
  const slug = f.replace(/\.html$/, "");
  const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1] || slug;
  const members = new Set(
    [...html.matchAll(/projects\/([a-zA-Z0-9-]+)/g)].map((m) => m[1])
  );
  fundMembers.set(slug, { name: h1.trim(), members: [...members] });
}
// project slug → fund slugs
const projectFunds = new Map();
for (const [fslug, f] of fundMembers)
  for (const p of f.members)
    projectFunds.set(p, [...(projectFunds.get(p) ?? []), fslug]);

async function fetchMeta(uri) {
  for (const g of GWS) {
    const u = uri.replace(/^https?:\/\/[^/]+\/ipfs\//, g);
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (r.ok) return r.json();
    } catch {}
  }
  return null;
}

const census = JSON.parse(fs.readFileSync(CENSUS, "utf8"));
// Optional: ONLY_IDS_FILE limits work to a list of token ids (one per line)
const onlyIds = process.env.ONLY_IDS_FILE
  ? new Set(fs.readFileSync(process.env.ONLY_IDS_FILE, "utf8").split(/\s+/).filter(Boolean))
  : null;
const entries = Object.entries(census).filter(([id]) => !onlyIds || onlyIds.has(id));

console.log(`-- claims.royalty_bps for per-project share (run guarded manually if exists)`);
console.log(`INSERT OR IGNORE INTO state(key,value) VALUES('royalty_default_bps','1000');`);

const out = [];
let ok = 0, fail = 0;
const CONCURRENCY = 10;
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  const metas = await Promise.all(
    entries.slice(i, i + CONCURRENCY).map(([, rec]) =>
      rec.uri ? fetchMeta(httpUrl(rec.uri)) : null
    )
  );
  for (let j = 0; j < Math.min(CONCURRENCY, entries.length - i); j++) {
    const [id] = entries[i + j];
    const meta = metas[j];
    const slug = meta?.external_url?.match(/(?:project\/|index\/p\/)([a-zA-Z0-9-]+)/)?.[1];
    if (!slug) { fail++; continue; }
    ok++;
    const pname = nameBySlug.get(slug) ?? slug;
    out.push(`UPDATE artifacts SET project=${esc(slug)} WHERE token_id=${esc(id)};`);
    out.push(
      `INSERT OR REPLACE INTO asset_traits(chain_id,collection_address,token_id,type,value) VALUES(${CHAIN},${esc(CONTRACT)},${esc(id)},'project',${esc(pname)});`
    );
    for (const fslug of projectFunds.get(slug) ?? []) {
      const fname = fundMembers.get(fslug)?.name ?? fslug;
      out.push(
        `INSERT OR REPLACE INTO asset_traits(chain_id,collection_address,token_id,type,value) VALUES(${CHAIN},${esc(CONTRACT)},${esc(id)},'fund',${esc(fname)});`
      );
    }
  }
  console.error(`batch ${Math.floor(i / CONCURRENCY) + 1}: ${ok} linked, ${fail} no-slug`);
}

// claims display names
for (const p of projects)
  out.push(`UPDATE claims SET name=${esc(p.name)} WHERE project=${esc(p.slug)};`);

// funds table
for (const [slug, f] of fundMembers) {
  const names = f.members.map((s) => nameBySlug.get(s) ?? s);
  out.push(
    `INSERT OR REPLACE INTO funds(id,name,mechanism,pool,projects) VALUES(${esc(slug)},${esc(f.name)},'artizen',NULL,${esc(JSON.stringify(names))});`
  );
}

// collection_traits rollup for the artifacts collection
out.push(`DELETE FROM collection_traits WHERE chain_id=${CHAIN} AND lower(collection_address)=${esc(CONTRACT)};`);
out.push(
  `INSERT INTO collection_traits(chain_id,collection_address,type,value,count)
   SELECT chain_id, collection_address, type, value, COUNT(*)
   FROM asset_traits
   WHERE chain_id=${CHAIN} AND lower(collection_address)=${esc(CONTRACT)}
   GROUP BY chain_id, collection_address, type, value;`
);

console.log(out.join("\n"));
console.error(`done: ${ok} artifacts linked to projects, ${fundMembers.size} funds`);
