// Flow-funding epoch engine for the indexer worker.
// Vendored engines: vendor/upstream/naoms-flow-funding (MIT). This file is the
// Commons-side adapter: policies/agreements live in D1, balances are read
// on-chain, every computed flow is recorded as a D1 event (EAS attestation is
// the settlement step, gated on the relayer).
//
// Settlement v1: flows are computed + recorded as `computed` events; a
// Safe-authorized relayer executes the ERC20 transfers. Upgrade path:
// FlowExecutor contract holding bounded per-node allowances.

import { gradientOutflow } from "../../../vendor/upstream/naoms-flow-funding/engine/gradient";
import { allocate, type FlowClaimant } from "../../../vendor/upstream/naoms-flow-funding/engine/allocate";
import {
  runFlowSimulation,
  type SimHolon,
  type SimReport,
  type SimOpts,
} from "../../../vendor/upstream/naoms-flow-funding/sim/driver";

export interface FlowPolicy {
  node: string; // graph node id (project/fund/person slug)
  address: string; // on-chain account whose stable balance the band watches
  floor: number;
  ceiling: number;
  gradient: number; // 0..1
  perClaimantCap: number; // 0..1
  perEpochCap: number; // 0..1 — max fraction of balance that may move per epoch
  denomination: string;
  enabled: number;
}

export interface FlowAgreement {
  id: string;
  from: string; // source node
  to: string; // dependent node
  trustWeight: number;
  formality: number; // 0 relational .. 1 codified
  tier: string;
  status: string; // proposed|active|revoked
}

export interface FlowLeg {
  from: string;
  to: string;
  amount: number;
}

export interface EpochResult {
  epoch: number;
  legs: FlowLeg[];
  totalFlowed: number;
  conserved: boolean;
  refusals: { node: string; residual: number }[];
}

/** Compute one epoch across the D1 graph state. Pure w.r.t. inputs. */
export function computeEpoch(
  epoch: number,
  policies: FlowPolicy[],
  agreements: FlowAgreement[],
  balances: Map<string, number>,
): EpochResult {
  const activePolicies = policies.filter((p) => p.enabled);
  const activeEdges = agreements.filter((a) => a.status === "active" && a.trustWeight > 0);
  const legs: FlowLeg[] = [];
  const refusals: EpochResult["refusals"] = [];
  let totalFlowed = 0;
  let conserved = true;
  const received = new Map<string, number>();
  const sent = new Map<string, number>();

  for (const p of activePolicies) {
    const balance = balances.get(p.node) ?? 0;
    const surplus = gradientOutflow(balance, p.floor, p.ceiling, p.gradient);
    const epochCap = Math.floor(balance * p.perEpochCap);
    const out = Math.min(surplus, epochCap);
    if (out <= 0) continue;

    // claimants = active agreement targets of this node, weighted by trust
    const edges = activeEdges.filter((e) => e.from === p.node);
    const claimants: FlowClaimant[] = edges
      .map((e) => {
        const dep = activePolicies.find((q) => q.node === e.to);
        if (!dep) return null;
        const depBal = (balances.get(e.to) ?? 0) + (received.get(e.to) ?? 0) - (sent.get(e.to) ?? 0);
        const need = Math.max(0, dep.floor - depBal);
        return { id: e.to, need, trustWeight: e.trustWeight };
      })
      .filter((c): c is FlowClaimant => c !== null && c.need > 0);

    try {
      const allocs = allocate(out, claimants, { perClaimantCap: p.perClaimantCap });
      for (const a of allocs) {
        if (a.amount <= 0) continue;
        legs.push({ from: p.node, to: a.id, amount: a.amount });
        received.set(a.id, (received.get(a.id) ?? 0) + a.amount);
        totalFlowed += a.amount;
      }
      sent.set(p.node, (sent.get(p.node) ?? 0) + out);
    } catch (e) {
      conserved = false;
      refusals.push({ node: p.node, residual: (e as { residual?: number }).residual ?? out });
    }
  }
  return { epoch, legs, totalFlowed, conserved, refusals };
}

export { runFlowSimulation, type SimHolon, type SimReport, type SimOpts };
