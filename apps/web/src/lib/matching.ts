// Matching engine ported from tbsoc/pastry (src/lib/matching.ts).
// Mechanisms: quadratic funding, 1:1 capped match, fixed multiplier.
// Pure functions — used for match previews over pledges/contributions.

export type Mechanism =
  | { type: "qf" }
  | { type: "match"; cap: number }
  | { type: "multiplier"; x: number };

export type Contribution = { projectId: string; donor: string; amount: number };

export interface MatchResult {
  matches: Record<string, number>;
  /** What the mechanism would pay if the pool were unlimited. */
  demand: number;
  /** Fraction of demand the pool can actually cover (1 = fully covered). */
  coverage: number;
}

export const MECHANISM_INFO: Record<
  Mechanism["type"],
  { name: string; short: string; explain: string }
> = {
  qf: {
    name: "Quadratic funding",
    short: "QF",
    explain:
      "The pool is split by how many people back a project, not how much any one person gives. Ten people giving $5 unlock far more than one person giving $50.",
  },
  match: {
    name: "1:1 match with cap",
    short: "1:1",
    explain:
      "Every contribution is matched one-for-one, up to a cap per donor per project. If demand exceeds the pool, everything is scaled down evenly.",
  },
  multiplier: {
    name: "Fixed multiplier",
    short: "×",
    explain:
      "Each contribution unlocks a fixed multiple from the pool. If demand exceeds the pool, everything is scaled down evenly.",
  },
};

export function mechanismLabel(m: Mechanism) {
  if (m.type === "qf") return "Quadratic funding";
  if (m.type === "match") return `1:1 match, up to ${m.cap} per donor`;
  return `${m.x}× multiplier`;
}

export function computeMatches(
  mechanism: Mechanism,
  pool: number,
  projectIds: string[],
  contributions: Contribution[]
): MatchResult {
  const per: Record<string, Record<string, number>> = {};
  for (const id of projectIds) per[id] = {};
  for (const c of contributions) {
    const bucket = per[c.projectId];
    if (!bucket) continue;
    bucket[c.donor] = (bucket[c.donor] ?? 0) + c.amount;
  }

  const raw: Record<string, number> = {};
  for (const id of projectIds) {
    const amounts = Object.values(per[id] ?? {});
    if (mechanism.type === "qf") {
      const sumSqrt = amounts.reduce((s, a) => s + Math.sqrt(a), 0);
      const sum = amounts.reduce((s, a) => s + a, 0);
      raw[id] = Math.max(0, sumSqrt * sumSqrt - sum);
    } else if (mechanism.type === "match") {
      raw[id] = amounts.reduce((s, a) => s + Math.min(a, mechanism.cap), 0);
    } else {
      raw[id] = amounts.reduce((s, a) => s + a, 0) * mechanism.x;
    }
  }

  const demand = Object.values(raw).reduce((s, v) => s + v, 0);
  const matches: Record<string, number> = {};
  if (demand <= 0) {
    for (const id of projectIds) matches[id] = 0;
    return { matches, demand: 0, coverage: 1 };
  }

  if (mechanism.type === "qf") {
    // QF always distributes the whole pool proportionally (CLR).
    for (const id of projectIds) matches[id] = (pool * (raw[id] ?? 0)) / demand;
    return { matches, demand, coverage: Math.min(1, pool / demand) };
  }

  const scale = Math.min(1, pool / demand);
  for (const id of projectIds) matches[id] = (raw[id] ?? 0) * scale;
  return { matches, demand, coverage: scale };
}

/** Raw (un-normalised) QF score per project. */
function qfScores(projectIds: string[], contributions: Contribution[]) {
  const per: Record<string, Record<string, number>> = {};
  for (const id of projectIds) per[id] = {};
  for (const c of contributions) {
    const bucket = per[c.projectId];
    if (bucket) bucket[c.donor] = (bucket[c.donor] ?? 0) + c.amount;
  }
  const out: Record<string, number> = {};
  for (const id of projectIds) {
    const amounts = Object.values(per[id] ?? {});
    const sumSqrt = amounts.reduce((s, a) => s + Math.sqrt(a), 0);
    out[id] = Math.max(0, sumSqrt * sumSqrt - amounts.reduce((s, a) => s + a, 0));
  }
  return out;
}

/**
 * Extra match unlocked per project by a set of new contributions.
 * QF shares a fixed pool, so new money dilutes others; we show the match a
 * gift attracts at today's rate (pool / total score).
 */
function matchDelta(
  mechanism: Mechanism,
  pool: number,
  projectIds: string[],
  contributions: Contribution[],
  donor: string,
  items: { projectId: string; amount: number }[]
) {
  const added = [
    ...contributions,
    ...items.map((i) => ({ projectId: i.projectId, donor, amount: i.amount })),
  ];
  const perProject: Record<string, number> = {};
  if (mechanism.type === "qf") {
    const before = qfScores(projectIds, contributions);
    const after = qfScores(projectIds, added);
    const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);
    const totalAfter = Object.values(after).reduce((a, b) => a + b, 0);
    const rate = pool / Math.max(1, totalBefore || totalAfter);
    for (const i of items)
      perProject[i.projectId] = Math.max(
        0,
        ((after[i.projectId] ?? 0) - (before[i.projectId] ?? 0)) * rate
      );
  } else {
    const before = computeMatches(mechanism, pool, projectIds, contributions);
    const after = computeMatches(mechanism, pool, projectIds, added);
    for (const i of items)
      perProject[i.projectId] = Math.max(
        0,
        (after.matches[i.projectId] ?? 0) - (before.matches[i.projectId] ?? 0)
      );
  }
  return perProject;
}

/** Extra match a project would receive if `donor` gave `amount` more now. */
export function marginalMatch(
  mechanism: Mechanism,
  pool: number,
  projectIds: string[],
  contributions: Contribution[],
  projectId: string,
  donor: string,
  amount: number
) {
  return matchDelta(mechanism, pool, projectIds, contributions, donor, [
    { projectId, amount },
  ])[projectId] ?? 0;
}
