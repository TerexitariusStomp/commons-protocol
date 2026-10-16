// src/packages/flow-funding/sim/driver.ts — 1644 M5 simulation driver.
//
// A holon previews a FlowPolicy variant over SYNTHETIC (or historical) flow state
// by running the REAL M3 engines (design §6.5 — "the real engine on the real write
// path, not a cheaper model") for one or more epochs, IN-PROCESS, producing an
// allocation report. The driver does NO I/O and NO chain writes — the "no-commit"
// guarantee is structural (a pure function over an in-memory snapshot), so a holon
// can watch a full epoch before committing real value. Reuses gradientOutflow +
// allocate + accrue verbatim (the same engines M3's settlement commits with).

import { accrue } from "../engine/accrual.ts";
import { gradientOutflow } from "../engine/gradient.ts";
import { allocate, type FlowClaimant } from "../engine/allocate.ts";
import { decayClaim } from "../engine/activity-decay.ts";

/** A synthetic holon in the simulation: its balance + armed band + flow channels. */
export interface SimHolon {
  id: string;
  balance: number;
  floor: number;
  ceiling: number;
  gradient?: number;
  /** Anti-capture per-claimant cap (fraction of surplus, 0..1). */
  perClaimantCap?: number;
  /** Per-epoch outflow cap (fraction of balance, 0..1). */
  perEpochCap?: number;
  /** Stream accrual rate (per attested-elapsed unit); 0 if no inflow. */
  rate?: number;
  /** Outbound channels this holon can flow surplus along. */
  channels?: SimChannel[];
}

export interface SimChannel {
  /** Target holon id (must be a holon in the set). */
  to: string;
  /** Trust-graph pull-weight; decays with the channel's inactivity. */
  trustWeight: number;
  /** Heartbeat-attested epochs the channel has been inactive (decays the claim). */
  inactiveEpochs?: number;
  /** Geometric decay rate of the claim per inactive epoch (0..1). */
  decayRate?: number;
}

export interface SimHolonResult {
  id: string;
  startBalance: number;
  accrued: number;
  surplus: number;
  outflow: number;
  received: number;
  endBalance: number;
}

export interface SimReport {
  epochs: number;
  perHolon: SimHolonResult[];
  totalFlowed: number;
  /** True iff every holon's settled outflow equalled its computed surplus. */
  conserved: boolean;
  /** Per-epoch outflow refusals (a surplus its channels could not absorb). */
  refusals: Array<{ holon: string; epoch: number; reason: string }>;
}

export interface SimOpts {
  epochs?: number;
  /** Heartbeat-attested elapsed per epoch (drives accrual; NEVER a wall clock). */
  attestedElapsedPerEpoch?: number;
}

/**
 * Run a flow simulation over `holons` for `epochs` epochs. Each epoch: every holon
 * accrues (rate × attestedElapsed), then — on a balance snapshot — computes its
 * gradient surplus and allocates it (conserved + capped, trust-weighted with claim
 * decay) along its channels to below-floor targets; deltas apply simultaneously.
 * Pure: returns the report, mutates nothing the caller passed, touches no chain.
 */
export function runFlowSimulation(
  holons: SimHolon[],
  opts: SimOpts = {},
): SimReport {
  const epochs = Math.max(1, Math.floor(opts.epochs ?? 1));
  const attestedElapsed = opts.attestedElapsedPerEpoch ?? 1;

  // Working copy — the caller's holons are never mutated (Honesty: no side effects).
  const bal = new Map<string, number>(holons.map((h) => [h.id, h.balance]));
  const byId = new Map<string, SimHolon>(holons.map((h) => [h.id, h]));
  const start = new Map<string, number>(bal);
  const accruedTotal = new Map<string, number>(holons.map((h) => [h.id, 0]));
  const outflowTotal = new Map<string, number>(holons.map((h) => [h.id, 0]));
  const receivedTotal = new Map<string, number>(holons.map((h) => [h.id, 0]));
  const refusals: SimReport["refusals"] = [];
  let conserved = true;
  let totalFlowed = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // 1. Accrual (lazy, heartbeat-attested — CIKU pattern).
    for (const h of holons) {
      if (h.rate && h.rate > 0) {
        const a = accrue(h.rate, attestedElapsed);
        bal.set(h.id, (bal.get(h.id) ?? 0) + a);
        accruedTotal.set(h.id, (accruedTotal.get(h.id) ?? 0) + a);
      }
    }
    // 2. Snapshot balances so allocation reads a consistent epoch state.
    const snapshot = new Map<string, number>(bal);
    const deltas = new Map<string, number>(holons.map((h) => [h.id, 0]));
    for (const h of holons) {
      const balance = snapshot.get(h.id) ?? 0;
      let surplus = gradientOutflow(
        balance,
        h.floor,
        h.ceiling,
        h.gradient ?? 0,
      );
      if (h.perEpochCap !== undefined) {
        surplus = Math.min(surplus, h.perEpochCap * balance);
      }
      if (surplus <= 0) continue;
      // Below-floor claimants reachable along this holon's channels, with the
      // channel's claim decayed by its inactivity.
      const claimants: FlowClaimant[] = (h.channels ?? [])
        .map((ch): FlowClaimant => {
          const targetBal = snapshot.get(ch.to) ?? 0;
          const targetFloor = byId.get(ch.to)?.floor ?? 0;
          const need = Math.max(0, targetFloor - targetBal);
          const weight = decayClaim(
            ch.trustWeight,
            ch.inactiveEpochs ?? 0,
            ch.decayRate ?? 0,
          );
          return { id: ch.to, need, trustWeight: weight };
        })
        .filter((c) => c.need > 0 && c.trustWeight > 0);
      try {
        const allocs = allocate(surplus, claimants, {
          perClaimantCap: h.perClaimantCap,
        });
        const out = allocs.reduce((s, a) => s + a.amount, 0);
        deltas.set(h.id, (deltas.get(h.id) ?? 0) - out);
        for (const a of allocs) {
          deltas.set(a.id, (deltas.get(a.id) ?? 0) + a.amount);
        }
        outflowTotal.set(h.id, (outflowTotal.get(h.id) ?? 0) + out);
        for (const a of allocs) {
          receivedTotal.set(a.id, (receivedTotal.get(a.id) ?? 0) + a.amount);
        }
        totalFlowed += out;
        if (Math.abs(out - surplus) > 1e-6) conserved = false;
      } catch (e) {
        // A surplus its channels cannot absorb is REFUSED (HC-01) — recorded in
        // the preview so the holon sees the unconservable epoch, never a silent drop.
        refusals.push({ holon: h.id, epoch, reason: (e as Error).message });
      }
    }
    // 3. Apply all deltas simultaneously.
    for (const [id, d] of deltas) bal.set(id, (bal.get(id) ?? 0) + d);
  }

  const perHolon: SimHolonResult[] = holons.map((h) => ({
    id: h.id,
    startBalance: start.get(h.id) ?? 0,
    accrued: accruedTotal.get(h.id) ?? 0,
    surplus: outflowTotal.get(h.id) ?? 0,
    outflow: outflowTotal.get(h.id) ?? 0,
    received: receivedTotal.get(h.id) ?? 0,
    endBalance: bal.get(h.id) ?? 0,
  }));
  return { epochs, perHolon, totalFlowed, conserved, refusals };
}
