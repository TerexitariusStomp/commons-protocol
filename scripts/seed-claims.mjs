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
