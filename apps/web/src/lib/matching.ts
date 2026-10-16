// Standard quadratic-funding matching math (Liberal Radicalism /
// cluster-match as popularized by Gitcoin & Allo). Clean implementation of
// the published formulas — no copied code.

export interface Contribution {
  contributor: string;
  project: string;
  amount: number; // in settlement units
}

export interface MatchResult {
  project: string;
  match: number;
  contributions: number;
}

/** Raw QF weight: (sum of sqrt(contribs))^2 - sum(contribs). */
export function qfWeight(amounts: number[]): number {
  const sum = amounts.reduce((a, b) => a + b, 0);
  const sqrtSum = amounts.reduce((a, b) => a + Math.sqrt(b), 0);
  return sqrtSum * sqrtSum - sum;
}

/** Distribute `pool` across projects proportional to QF weight. */
export function quadraticMatch(contribs: Contribution[], pool: number): MatchResult[] {
  const byProject = new Map<string, number[]>();
  for (const c of contribs) {
    if (!byProject.has(c.project)) byProject.set(c.project, []);
    byProject.get(c.project)!.push(c.amount);
  }
  const weights = [...byProject.entries()].map(([project, amts]) => ({
    project,
    weight: qfWeight(amts),
    total: amts.reduce((a, b) => a + b, 0),
  }));
  const totalWeight = weights.reduce((a, w) => a + w.weight, 0);
  if (totalWeight === 0) return weights.map((w) => ({ project: w.project, match: 0, contributions: w.total }));
  return weights.map((w) => ({
    project: w.project,
    match: (w.weight / totalWeight) * pool,
    contributions: w.total,
  }));
}

/** 1:1 match capped at `cap` per project. */
export function cappedMatch(contribs: Contribution[], pool: number, cap: number): MatchResult[] {
  const totals = new Map<string, number>();
  for (const c of contribs) totals.set(c.project, (totals.get(c.project) ?? 0) + c.amount);
  return [...totals.entries()].map(([project, total]) => ({
    project,
    match: Math.min(total, cap, pool),
    contributions: total,
  }));
}

/** Fixed multiplier on contributions, bounded by pool. */
export function multiplierMatch(contribs: Contribution[], pool: number, multiplier: number): MatchResult[] {
  const totals = new Map<string, number>();
  for (const c of contribs) totals.set(c.project, (totals.get(c.project) ?? 0) + c.amount);
  const raw = [...totals.entries()].map(([project, total]) => ({
    project,
    match: total * multiplier,
    contributions: total,
  }));
  const sum = raw.reduce((a, r) => a + r.match, 0);
  if (sum <= pool) return raw;
  const scale = pool / sum;
  return raw.map((r) => ({ ...r, match: r.match * scale }));
}

/** Equal split across selected projects (per-fund default in the graph). */
export function equalSplit(projects: string[], pool: number): MatchResult[] {
  if (projects.length === 0) return [];
  const each = pool / projects.length;
  return projects.map((project) => ({ project, match: each, contributions: 0 }));
}
