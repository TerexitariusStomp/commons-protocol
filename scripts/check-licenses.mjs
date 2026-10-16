#!/usr/bin/env node
// License gate: every production dependency must carry a commercially usable
// license. Copyleft is fine (AGPL/GPL/LGPL/MPL). BSL/SSPL/Elastic/non-commercial/
// unlicensed packages fail the build.
//
// Usage: node scripts/check-licenses.mjs [package-dir ...]
// Default: apps/web/ and workers/*/

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// SPDX allowlist — all permit commercial use.
const ALLOW = [
  /^MIT$/i,
  /^ISC$/i,
  /^0BSD$/i,
  /^BSD-\d-Clause$/i,
  /^Apache-2\.0$/i,
  /^MPL-2\.0$/i,
  /^BlueOak-1\.0\.0$/i,
  /^CC0-1\.0$/i,
  /^Unlicense$/i,
  /^WTFPL$/i,
  /^Python-2\.0$/i,
  /^OFL-1\.1$/i,
  /^CC-BY-4\.0$/i,
  /^CC-BY-SA-4\.0$/i,
  /^(A|L?|E)GPL-\d\.\d(-(only|or-later))?$/i,
];

// Packages whose published tarball lacks license metadata but whose registry
// entry has been manually verified. Map: name → verified SPDX id.
const VERIFIED_EXCEPTIONS = {
  "@metamask/eth-json-rpc-provider": "ISC", // registry field; tarball omits it
};

// Walk node_modules (npm workspaces hoist to the root). Falls back to any
// nested node_modules found under apps/ and workers/.
function collectNodeModules(dir, acc = []) {
  const nm = path.join(dir, "node_modules");
  if (existsSync(nm)) acc.push(nm);
  for (const sub of ["apps", "workers", "packages"]) {
    const p = path.join(dir, sub);
    if (existsSync(p)) {
      for (const child of readdirSync(p)) {
        const cp = path.join(p, child);
        if (statSync(cp).isDirectory()) collectNodeModules(cp, acc);
      }
    }
  }
  return acc;
}

function* walkPackages(nmDir) {
  for (const entry of readdirSync(nmDir)) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      const scoped = path.join(nmDir, entry);
      try {
        for (const sub of readdirSync(scoped)) {
          const pj = path.join(scoped, sub, "package.json");
          if (existsSync(pj)) yield pj;
        }
      } catch {}
    } else {
      const pj = path.join(nmDir, entry, "package.json");
      if (existsSync(pj)) yield pj;
    }
  }
}

function normalizeLicense(pkgJson) {
  const lic = pkgJson.license ?? pkgJson.licenses;
  if (!lic) return null;
  if (typeof lic === "string") return lic;
  if (Array.isArray(lic)) return lic.map((l) => (typeof l === "string" ? l : l.type)).join(" OR ");
  if (typeof lic === "object" && lic.type) return lic.type;
  return null;
}

// Evaluate an SPDX expression: OR passes if any operand is allowed,
// AND requires all operands allowed. WITH exceptions are tolerated
// (their base license still must be allowed).
function licenseOk(expr) {
  const cleaned = expr.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (/\s+OR\s+/i.test(cleaned)) {
    return cleaned.split(/\s+OR\s+/i).some(licenseOk);
  }
  const operands = cleaned
    .split(/\s+AND\s+|\s+WITH\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return operands.length > 0 && operands.every((op) => ALLOW.some((re) => re.test(op)));
}

let failures = 0;
const seen = new Set();
for (const nmDir of collectNodeModules(ROOT)) {
  for (const pjPath of walkPackages(nmDir)) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pjPath, "utf8"));
    } catch {
      continue;
    }
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const license = normalizeLicense(pkg);
    const exception = VERIFIED_EXCEPTIONS[pkg.name];
    if (!license) {
      if (exception) {
        console.log(`ok   ${key} — no license field, registry verified ${exception}`);
      } else {
        failures++;
        console.error(`FAIL ${key} — no license declared`);
      }
    } else if (!licenseOk(license) && !exception) {
      failures++;
      console.error(`FAIL ${key} — license "${license}"`);
    } else if (!licenseOk(license) && exception) {
      console.log(`ok   ${key} — license "${license}", overridden by verified ${exception}`);
    }
  }
}

if (failures) {
  console.error(`\n${failures} package(s) with non-commercial/unknown licenses. Remove, replace, or verify and add to VERIFIED_EXCEPTIONS.`);
  process.exit(1);
}
console.log("License gate passed: all dependencies are commercially usable.");
