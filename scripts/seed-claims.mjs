#!/usr/bin/env node
// Seeds the indexer D1 `claims` table from the Artizen shortfall ledger and
// `artifacts` from the census output. Emits SQL to stdout.
//
// Usage: node scripts/seed-claims.mjs > seed.sql && wrangler d1 execute commons-index --file seed.sql
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHORTFALL = "/home/terex/Documents/artizen-public/shortfall-data.js";
const CENSUS = path.join(ROOT, "docs/census-artifacts.json");

const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const raw = fs.readFileSync(SHORTFALL, "utf8");
const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
const rows = JSON.parse(json);
console.log("--", rows.length, "projects from shortfall ledger");
for (const r of rows) {
  console.log(
    `INSERT OR REPLACE INTO claims(project,shortfall,status) VALUES(${esc(r.s)},${esc(String(r.sh))},'unclaimed');`
  );
}

if (fs.existsSync(CENSUS)) {
  const census = JSON.parse(fs.readFileSync(CENSUS, "utf8"));
  console.log("--", Object.keys(census).length, "artifact tokenIds from census");
  for (const [id, rec] of Object.entries(census)) {
    const supply = rec.holders?.reduce((a, [, b]) => a + Number(b), 0) ?? 0;
    console.log(
      `INSERT OR REPLACE INTO artifacts(token_id,project,metadata_uri,uri_alive,total_supply,first_block) VALUES(${esc(id)},${esc(rec.project ?? "")},${esc(rec.uri ?? "")},${rec.uri ? 1 : 0},${esc(String(supply))},NULL);`
    );
  }
}

// ---- marketplace substrate: artifact collection + assets + ownerships ----
// The census indexes the Artizen Seasons ERC-1155 on Ethereum mainnet.
const ARTIFACT_CONTRACT = "0x20cddf283164ee59742c80aa5ce9b97127f123ce";
const CHAIN = 1;
if (fs.existsSync(CENSUS)) {
  const census = JSON.parse(fs.readFileSync(CENSUS, "utf8"));
  const ids = Object.keys(census);
  const totalSupply = ids.reduce((a, id) => a + (census[id].holders?.reduce((x, [, b]) => x + Number(b), 0) ?? 0), 0);
  const owners = new Set(ids.flatMap((id) => (census[id].holders ?? []).map(([a]) => a)));
  console.log(
    `INSERT OR REPLACE INTO collections(chain_id,address,name,description,standard,total_supply,total_owners,verified,created_at,updated_at) VALUES(${CHAIN},${esc(ARTIFACT_CONTRACT)},'Artizen Artifacts','Artifact editions issued by Artizen-funded public-goods projects','ERC1155',${esc(String(totalSupply))},${owners.size},1,unixepoch(),unixepoch());`
  );
  for (const [id, rec] of Object.entries(census)) {
    const supply = rec.holders?.reduce((a, [, b]) => a + Number(b), 0) ?? 0;
    console.log(
      `INSERT OR REPLACE INTO assets(chain_id,collection_address,token_id,name,quantity,token_uri,created_at,updated_at) VALUES(${CHAIN},${esc(ARTIFACT_CONTRACT)},${esc(id)},${esc("Artifact #" + id)},${esc(String(supply))},${esc(rec.uri ?? "")},unixepoch(),unixepoch());`
    );
    for (const [holder, qty] of rec.holders ?? []) {
      console.log(
        `INSERT OR REPLACE INTO ownerships(chain_id,collection_address,token_id,owner_address,quantity) VALUES(${CHAIN},${esc(ARTIFACT_CONTRACT)},${esc(id)},${esc(holder)},${esc(String(qty))});`
      );
    }
  }
}
