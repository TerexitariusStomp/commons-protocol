import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  runFlowSimulation,
  type SimHolon,
} from "../../../../vendor/upstream/naoms-flow-funding/sim/driver";

const INDEXER = import.meta.env.VITE_INDEXER ?? "";

interface Policy {
  node: string;
  floor: number;
  ceiling: number;
  gradient: number;
  per_claimant_cap: number;
  per_epoch_cap: number;
  enabled: number;
}

export default function Flow() {
  const { data: policies } = useQuery({
    queryKey: ["flow-policies"],
    queryFn: async () => (INDEXER ? (await fetch(`${INDEXER}/flow/policies`)).json() : []),
  });
  const { data: events } = useQuery({
    queryKey: ["flow-events"],
    queryFn: async () => (INDEXER ? (await fetch(`${INDEXER}/flow/events`)).json() : []),
  });

  const [scenario, setScenario] = useState(
    JSON.stringify(
      [
        { id: "pot", balance: 50000, floor: 10000, ceiling: 40000, gradient: 0.5,
          channels: [{ to: "project-a", trustWeight: 1 }, { to: "project-b", trustWeight: 0.5 }] },
        { id: "project-a", balance: 2000, floor: 8000, ceiling: 20000, channels: [] },
        { id: "project-b", balance: 1000, floor: 5000, ceiling: 15000, channels: [] },
      ],
      null,
      2
    )
  );
  const [report, setReport] = useState<string>("");

  const runSim = () => {
    try {
      const holons = JSON.parse(scenario) as SimHolon[];
      const r = runFlowSimulation(holons, { epochs: 12 });
      setReport(JSON.stringify(r, null, 2));
    } catch (e) {
      setReport(`error: ${(e as Error).message}`);
    }
  };

  return (
    <section>
      <h1>Flow Funding</h1>
      <p>
        Continuous, homeostatic circulation: a node above its ceiling flows surplus to its dependents; below-floor
        nodes draw support. Matching rounds are episodic — flows are peristaltic. Both are per-node configuration.
      </p>

      <h2>Armed policies</h2>
      <div className="grid">
        {((policies as Policy[]) ?? []).map((p) => (
          <div className="card" key={p.node}>
            <h3>{p.node}</h3>
            <div>
              band [{p.floor} — {p.ceiling}] gradient {p.gradient}
            </div>
            <div>
              caps: {p.per_claimant_cap * 100}%/claimant, {p.per_epoch_cap * 100}%/epoch
            </div>
          </div>
        ))}
        {(!policies || (policies as Policy[]).length === 0) && <div className="card">No policies armed yet.</div>}
      </div>

      <h2>Simulate before arming</h2>
      <div className="card">
        <label>Scenario (SimHolon[])</label>
        <textarea
          style={{ width: "100%", minHeight: 220, fontFamily: "monospace", fontSize: 12, background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, padding: 8 }}
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
        />
        <button style={{ marginTop: 8 }} onClick={runSim}>
          Run 12-epoch simulation
        </button>
        {report && <pre style={{ maxHeight: 300, overflow: "auto", fontSize: 12 }}>{report}</pre>}
      </div>

      <h2>Recent flows</h2>
      {((events as { epoch: number; from_node: string; to_node: string; amount: number; status: string }[]) ?? []).map(
        (e, i) => (
          <div className="card" key={i}>
            epoch {e.epoch}: {e.from_node} → {e.to_node} — {e.amount} ({e.status})
          </div>
        )
      )}
    </section>
  );
}
