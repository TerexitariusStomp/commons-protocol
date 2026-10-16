// src/packages/flow-funding/engine/activity-decay.ts — 1644 M3 activity decay.
//
// The second LIVE anti-hoarding engine (design §6.2): a node's CLAIM — its
// pull-weight on a holon's surplus — decays with inactivity. Tree's "stay in the
// river": entitlement is sustained by participation, not accrued in perpetuity.
//   weight = baseWeight × (1 − decayRate)^floor(inactiveEpochs)
// This decays the CLAIM (a routing weight), NEVER a balance — decaying an idle
// balance is demurrage (item 1645), explicitly NOT a 1644 engine (design §6.2).
// Pure; no clock (inactiveEpochs is heartbeat-attested, supplied by the caller).

export class FlowDecayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowDecayError";
  }
}

/**
 * Decay a claim's pull-weight after `inactiveEpochs` of inactivity. Geometric
 * decay: each inactive epoch multiplies the weight by (1 − decayRate). Refuses
 * LOUD on invalid input (Honesty axiom). `inactiveEpochs` is floored — whole
 * attested epochs only — so decay is causal-prefix deterministic, no wall clock.
 */
export function decayClaim(
  baseWeight: number,
  inactiveEpochs: number,
  decayRate: number,
): number {
  if (!Number.isFinite(baseWeight) || baseWeight < 0) {
    throw new FlowDecayError(
      `baseWeight must be a finite, non-negative number (got ${baseWeight})`,
    );
  }
  if (!Number.isFinite(inactiveEpochs) || inactiveEpochs < 0) {
    throw new FlowDecayError(
      `inactiveEpochs must be a finite, non-negative number (got ` +
        `${inactiveEpochs}) — supply heartbeat-attested epochs, never Date.now()`,
    );
  }
  if (!Number.isFinite(decayRate) || decayRate < 0 || decayRate > 1) {
    throw new FlowDecayError(`decayRate must be in [0,1] (got ${decayRate})`);
  }
  return baseWeight * Math.pow(1 - decayRate, Math.floor(inactiveEpochs));
}
