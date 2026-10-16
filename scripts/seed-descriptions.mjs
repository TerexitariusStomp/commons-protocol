#!/usr/bin/env node
// Emits UPDATE SQL adding short descriptions/taglines to claims + funds.
// Projects: description from archive/projects.json
// Funds:    first <p class='sub'> tagline under the <h1> in archive/funds/*.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const ARCHIVE = '/home/terex/Documents/artizen-public/archive'
const esc = (s) => s.replaceAll("'", "''")
const deent = (s) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[m]))

// ---- funds ----
const fundDesc = new Map()
for (const f of readdirSync(`${ARCHIVE}/funds`)) {
  if (!f.endsWith('.html')) continue
  const slug = f.replace(/\.html$/, '')
  const h = readFileSync(`${ARCHIVE}/funds/${f}`, 'utf8')
  // tagline: first <p class='sub'> after the <h1>
  const h1 = h.indexOf('<h1>')
  const m = h1 >= 0 ? h.slice(h1).match(/<p class='sub'>([^<]{4,400})<\/p>/) : null
  if (m) fundDesc.set(slug, m[1].replace(/\s+/g, ' ').trim())
}

// ---- projects ----
const projects = JSON.parse(readFileSync(`${ARCHIVE}/projects.json`, 'utf8'))
const projDesc = new Map()
for (const p of projects) {
  if (p.slug && p.description)
    projDesc.set(p.slug, String(p.description).replace(/\s+/g, ' ').trim())
}

const sql = []
for (const [slug, d] of fundDesc)
  sql.push(`UPDATE funds SET description='${esc(d)}' WHERE id='${esc(slug)}';`)
for (const [slug, d] of projDesc)
  sql.push(`UPDATE claims SET description='${esc(d)}' WHERE project='${esc(slug)}';`)

writeFileSync('/tmp/seed-descriptions.sql', sql.join('\n'))
console.log(`funds=${fundDesc.size} projects=${projDesc.size} -> /tmp/seed-descriptions.sql`)
