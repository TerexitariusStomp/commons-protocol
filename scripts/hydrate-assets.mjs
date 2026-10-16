#!/usr/bin/env node
// Fetches token_uri metadata for seeded assets and emits UPDATE SQL.
// Usage: node scripts/hydrate-assets.mjs > hydrate.sql && wrangler d1 execute commons-index --remote --file hydrate.sql
import fs from "node:fs";
const CENSUS = "docs/census-artifacts.json";
const GWS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://nftstorage.link/ipfs/",
];
const CONTRACT = "0x20cddf283164ee59742c80aa5ce9b97127f123ce";
const esc = (s) => "'" + String(s).replace(/[\r\n]+/g, ' ').replace(/'/g, "''") + "'";
const httpUrl = (u) => (u ?? "").replace(/^ipfs:\/\//, GWS[0]);
const census = JSON.parse(fs.readFileSync(CENSUS, "utf8"));

async function fetchMeta(uri) {
  for (const g of GWS) {
    const u = uri.replace(/^https?:\/\/[^/]+\/ipfs\//, g);
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return r.json();
    } catch {}
  }
  return null;
}

const entries = Object.entries(census);
const CONCURRENCY = 20;
let ok = 0, fail = 0;
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  const batch = entries.slice(i, i + CONCURRENCY);
  const metas = await Promise.all(
    batch.map(([id, rec]) => (rec.uri ? fetchMeta(httpUrl(rec.uri)) : null))
  );
  batch.forEach(([id], j) => {
    const meta = metas[j];
    if (!meta) { fail++; return; }
    const image = httpUrl(meta.image ?? meta.image_url ?? "");
    const anim = httpUrl(meta.animation_url ?? "") || null;
    console.log(`UPDATE assets SET name=${esc(meta.name ?? "Artifact #" + id)}, image=${esc(image)}, animation_url=${anim ? esc(anim) : "NULL"}, description=${esc(meta.description ?? "")}, updated_at=unixepoch() WHERE chain_id=1 AND collection_address=${esc(CONTRACT)} AND token_id=${esc(id)};`);
    if (Array.isArray(meta.attributes))
      for (const t of meta.attributes)
        if (t?.trait_type != null)
          console.log(`INSERT OR REPLACE INTO asset_traits(chain_id,collection_address,token_id,type,value) VALUES(1,${esc(CONTRACT)},${esc(id)},${esc(t.trait_type)},${esc(String(t.value ?? ""))});`);
    ok++;
  });
  console.error(`batch ${i / CONCURRENCY + 1}: ${ok} ok, ${fail} fail`);
}
console.error(`hydrated ${ok}, failed ${fail}`);
