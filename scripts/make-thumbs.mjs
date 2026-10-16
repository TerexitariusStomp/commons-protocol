#!/usr/bin/env node
// Generates 800px WebP thumbnails for all ipfs:// image cids in D1 and emits
// INSERT OR REPLACE INTO thumbs SQL (hex blob literals). Apply with:
//   node scripts/make-thumbs.mjs
//   npx wrangler d1 execute commons-index --remote -y --file /tmp/thumbs.sql
import { execFileSync, execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CONCURRENCY = 6
const TMP = mkdtempSync(join(tmpdir(), 'thumbs-'))
const GWS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.filebase.io/ipfs/',
  'https://nftstorage.link/ipfs/',
]

// 1. distinct image cids already in thumbs vs missing
const cidRows = JSON.parse(
  execSync(
    `npx wrangler d1 execute commons-index --remote -y --json --command "SELECT DISTINCT image FROM assets WHERE image LIKE 'ipfs://%' UNION SELECT DISTINCT image FROM accounts WHERE image LIKE 'ipfs://%' UNION SELECT DISTINCT image FROM collections WHERE image LIKE 'ipfs://%'"`,
    { cwd: new URL('../workers/indexer', import.meta.url).pathname },
  ).toString(),
)[0].results
const have = new Set(
  JSON.parse(
    execSync(
      `npx wrangler d1 execute commons-index --remote -y --json --command "SELECT cid FROM thumbs"`,
      { cwd: new URL('../workers/indexer', import.meta.url).pathname },
    ).toString(),
  )[0].results.map((r) => r.cid),
)
const cids = [...new Set(cidRows.map((r) => String(r.image).slice(7)))].filter(
  (c) => !have.has(c),
)
console.log(`${cids.length} cids to thumbnail (${have.size} already done)`)

async function fetchIpfs(cid) {
  for (const gw of GWS) {
    try {
      const r = await fetch(gw + cid, { signal: AbortSignal.timeout(30000) })
      if (r.ok) return Buffer.from(await r.arrayBuffer())
    } catch {}
  }
  return null
}

const esc = (s) => s.replaceAll("'", "''")
const sql = []
let done = 0,
  failed = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    let cid
    while ((cid = cids.pop())) {
      try {
        const buf = await fetchIpfs(cid)
        if (!buf) {
          failed++
          continue
        }
        const src = join(TMP, `s${done + failed}`)
        const dst = join(TMP, `t${done + failed}.webp`)
        writeFileSync(src, buf)
        execFileSync('magick', [
          src,
          '-resize',
          '800x800',
          '-quality',
          '82',
          dst,
        ])
        const webp = readFileSync(dst)
        sql.push(
          `INSERT OR REPLACE INTO thumbs(cid,data,ctype) VALUES('${esc(cid)}',X'${webp.toString('hex')}','image/webp');`,
        )
        done++
      } catch {
        failed++
      }
      if ((done + failed) % 10 === 0)
        console.log(`  ${done} ok / ${failed} fail`)
    }
  }),
)
writeFileSync('/tmp/thumbs.sql', sql.join('\n'))
console.log(`done=${done} failed=${failed} -> /tmp/thumbs.sql`)
