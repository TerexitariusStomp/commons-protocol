// src/packages/flow-funding/engine/accrual.ts — 1644 M3 flow accrual.
//
// Lazy, heartbeat-attested accrual (design §6.3, HC-04): `accrued =
// floor(attestedElapsed) × rate`, mirroring the verified CIKU same-chain ceiling
// (token/kinds/ciku/ceiling.ts: `ceiling = floor(attestedElapsedHours) ×
// unitsPerHour`). `attestedElapsed` is derived by the CALLER from peer HEARTBEAT
// attestations — this module reads NO clock and does NO I/O (HC-21: never
// Date.now()). A flow stream emits no per-tick transactions; accrual is computed
// once at fold/settlement from the attested elapsed since the policy's epoch.

export class FlowAccrualError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowAccrualError";
  }
}

/**
 * accrued = floor(attestedElapsed) × rate.
 *
 * `attestedElapsed` is in the policy's own epoch units (e.g. heartbeat-attested
 * hours/epochs since `accrualEpoch`), supplied by the caller from peer heartbeat
 * attestations — NEVER a wall clock. Floors the elapsed (whole attested units
 * only, exactly as the CIKU ceiling does) so accrual is causal-prefix
 * deterministic. Refuses LOUD on invalid input rather than silently clamping to
 * 0 (Honesty axiom — a negative/NaN elapsed is a bug to surface, not absorb).
 */
export function accrue(rate: number, attestedElapsed: number): number {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new FlowAccrualError(
      `rate must be a finite, non-negative number (got ${rate})`,
    );
  }
  if (!Number.isFinite(attestedElapsed) || attestedElapsed < 0) {
    throw new FlowAccrualError(
      `attestedElapsed must be a finite, non-negative number (got ` +
        `${attestedElapsed}) — supply heartbeat-attested elapsed, never Date.now()`,
    );
  }
  return Math.floor(attestedElapsed) * rate;
}
