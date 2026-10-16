// src/packages/flow-funding/engine/gradient.ts — 1644 M3 gradient outflow engine.
//
// One of 1644's two LIVE anti-hoarding engines (design §6.2): surplus ABOVE the
// ceiling flows out. The FlowPolicy `gradient` (0..1, design §5 "curve shape
// between floor and ceiling") shapes the band edge:
//   gradient = 0  → HARD switch: the entire surplus above the ceiling flows.
//   gradient → 1  → SMOOTH ramp: the outflow fraction eases in, scaled by the
//                   band width, so a balance just over the ceiling trickles out
//                   rather than dumping its whole surplus in one epoch.
// Pure arithmetic — no clock, no I/O. Acts on SURPLUS (a balance above ceiling),
// never on idle balances (that is demurrage = item 1645, not a 1644 engine).

export class FlowGradientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowGradientError";
  }
}

/**
 * Outflow for one holon this epoch given its `balance` and viability band
 * [`floor`, `ceiling`]. Returns the amount of surplus that flows OUT (≥ 0).
 *
 * Refuses LOUD on an inverted band or out-of-range gradient (Honesty axiom — a
 * malformed band is a configuration bug, not something to silently normalise).
 */
export function gradientOutflow(
  balance: number,
  floor: number,
  ceiling: number,
  gradient = 0,
): number {
  if (![balance, floor, ceiling, gradient].every((n) => Number.isFinite(n))) {
    throw new FlowGradientError(
      `balance/floor/ceiling/gradient must all be finite (got ` +
        `${balance}/${floor}/${ceiling}/${gradient})`,
    );
  }
  if (ceiling < floor) {
    throw new FlowGradientError(
      `inverted viability band: ceiling (${ceiling}) < floor (${floor})`,
    );
  }
  if (gradient < 0 || gradient > 1) {
    throw new FlowGradientError(`gradient must be in [0,1] (got ${gradient})`);
  }
  if (balance <= ceiling) return 0;
  const surplus = balance - ceiling;
  if (gradient === 0) return surplus; // hard switch — all surplus flows
  // Smooth ramp: the outflow fraction grows 0→1 as the surplus spans
  // gradient×band, so just-over-ceiling eases out and a large surplus still
  // flows (asymptotically) in full. `band` is floored at 1 to avoid a divide-by-
  // zero when floor == ceiling (a zero-width band degrades to a near-hard edge).
  const band = Math.max(1, ceiling - floor);
  const fraction = Math.min(1, surplus / (gradient * band));
  return surplus * fraction;
}
