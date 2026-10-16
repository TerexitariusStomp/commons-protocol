// Copies the canonical whitepaper into the web app's public dir so
// /whitepaper can fetch it at runtime. docs/WHITEPAPER.md is the source of truth.
import { copyFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'docs', 'WHITEPAPER.md')
const dest = join(root, 'apps', 'web', 'public', 'whitepaper.md')

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`synced ${src} -> ${dest}`)
