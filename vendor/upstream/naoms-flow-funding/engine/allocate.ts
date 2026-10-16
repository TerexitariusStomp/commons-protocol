// src/packages/flow-funding/engine/allocate.ts — 1644 M3 conserved allocator.
//
// Emergent, trust-weighted allocation (design §6.4): a holon's surplus is split
// across its below-floor claimants by NEED × TRUST-WEIGHT pull — need is gravity,
// trust is terrain, NO central router. Two caps bound the blast radius (HC-05):
//   - per-claimant cap: no single (possibly sybil-farmed) claimant captures the
//     surplus; farmed edges carry low trust-weight, so they pull weakly (DE-23).
//   - per-epoch cap: applied UPSTREAM by the caller bounding `surplus` so a deep
//     transitive cascade cannot drain a holon faster than its rate (DE-24).
// CONSERVATION (HC-01 / AX-H1): Σ(out) == surplus exactly. When the eligible
// claimants + caps cannot absorb the surplus, the allocator REFUSES LOUD with the
// residual — never a silent clamp or silent retention. Pure; no clock, no I/O.

export class FlowConservationError extends Error {
  /** The amount that could not be conserved (surplus − Σ(out)). */
  readonly residual: number;
  constructor(message: string, residual: number) {
    super(message);
    this.name = "FlowConservationError";
    this.residual = residual;
  }
}

export interface FlowClaimant {
  id: string;
  /** Unmet need: how far below floor this claimant sits (≥ 0). */
  need: number;
  /** Trust-graph pull-weight (030–031 edges; ≥ 0). Farmed edges → low weight. */
  trustWeight: number;
}

export interface FlowAllocation {
  id: string;
  amount: number;
}

export interface AllocateOpts {
  /** Max fraction of `surplus` any single claimant may receive (HC-05), 0..1. */
  perClaimantCap?: number;
  /** Convergence tolerance for the conservation assertion. */
  epsilon?: number;
}

/**
 * Split `surplus` across `claimants` proportional to need × trustWeight, bounded
 * by each claimant's need and the per-claimant cap, via iterative water-filling
 * (spillover from capped claimants redistributes to those with headroom). Returns
 * one allocation per input claimant (0 for the ineligible/unfunded). Refuses LOUD
 * (FlowConservationError) when the eligible absorbable capacity is below `surplus`.
 */
export function allocate(
  surplus: number,
  claimants: FlowClaimant[],
  opts: AllocateOpts = {},
): FlowAllocation[] {
  const epsilon = opts.epsilon ?? 1e-9;
  if (!Number.isFinite(surplus) || surplus < 0) {
    throw new FlowConservationError(
      `surplus must be a finite, non-negative number (got ${surplus})`,
      Number.NaN,
    );
  }
  for (const c of claimants) {
    if (!Number.isFinite(c.need) || c.need < 0) {
      throw new FlowConservationError(
        `claimant ${c.id}: need must be finite >= 0 (got ${c.need})`,
        Number.NaN,
      );
    }
    if (!Number.isFinite(c.trustWeight) || c.trustWeight < 0) {
      throw new FlowConservationError(
        `claimant ${c.id}: trustWeight must be finite >= 0 (got ${c.trustWeight})`,
        Number.NaN,
      );
    }
  }
  const perClaimantCap = opts.perClaimantCap;
  if (
    perClaimantCap !== undefined &&
    (!Number.isFinite(perClaimantCap) || perClaimantCap < 0 ||
      perClaimantCap > 1)
  ) {
    throw new FlowConservationError(
      `perClaimantCap must be in [0,1] (got ${perClaimantCap})`,
      Number.NaN,
    );
  }

  const zero = (): FlowAllocation[] =>
    claimants.map((c) => ({ id: c.id, amount: 0 }));
  if (surplus === 0) return zero();

  // Per-claimant ceiling on what each MAY receive: bounded by their own need and
  // the anti-capture cap (a fraction of the surplus).
  const capAmount = perClaimantCap !== undefined
    ? perClaimantCap * surplus
    : Number.POSITIVE_INFINITY;
  const maxReceive = (c: FlowClaimant) => Math.min(c.need, capAmount);

  // Only claimants with BOTH unmet need AND positive trust-weight pull surplus
  // (need is gravity, trust is terrain — design §6.4). The rest get 0.
  const eligible = claimants.filter((c) =>
    c.need > 0 && c.trustWeight > 0 && maxReceive(c) > 0
  );
  const totalAbsorbable = eligible.reduce((s, c) => s + maxReceive(c), 0);
  if (totalAbsorbable + epsilon < surplus) {
    throw new FlowConservationError(
      `cannot conserve: surplus ${surplus} exceeds the eligible absorbable ` +
        `capacity ${totalAbsorbable} — ${
          surplus - totalAbsorbable
        } would be unallocatable (too few trusted below-floor claimants, or the ` +
        `per-claimant cap is too tight). Refuse loud — no silent retention (HC-01).`,
      surplus - totalAbsorbable,
    );
  }

  const alloc = new Map<string, number>(claimants.map((c) => [c.id, 0]));
  let active = [...eligible];
  let remaining = surplus;
  let guard = 0;
  while (remaining > epsilon && active.length > 0 && guard++ < 100_000) {
    const totalWeight = active.reduce((s, c) => s + c.need * c.trustWeight, 0);
    if (totalWeight <= 0) break;
    let distributed = 0;
    for (const c of active) {
      const share = remaining * (c.need * c.trustWeight) / totalWeight;
      const headroom = maxReceive(c) - (alloc.get(c.id) ?? 0);
      const give = Math.min(share, headroom);
      alloc.set(c.id, (alloc.get(c.id) ?? 0) + give);
      distributed += give;
    }
    remaining -= distributed;
    // Drop claimants that have reached their ceiling; the spillover redistributes
    // to those with remaining headroom on the next pass.
    active = active.filter((c) =>
      maxReceive(c) - (alloc.get(c.id) ?? 0) > epsilon
    );
    if (distributed <= epsilon) break; // no progress — avoid a spin
  }

  const total = [...alloc.values()].reduce((s, v) => s + v, 0);
  if (Math.abs(total - surplus) > epsilon * Math.max(1, surplus)) {
    throw new FlowConservationError(
      `non-conservation: Σ(out)=${total} != surplus=${surplus} (residual ` +
        `${surplus - total}) — refuse loud (HC-01, no silent clamp)`,
      surplus - total,
    );
  }
  return claimants.map((c) => ({ id: c.id, amount: alloc.get(c.id) ?? 0 }));
}
