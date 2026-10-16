import { useQuery } from "@tanstack/react-query";
import { quadraticMatch } from "../lib/matching";

const INDEXER = import.meta.env.VITE_INDEXER ?? "";

export default function Funds() {
  const { data } = useQuery({
    queryKey: ["funds"],
    queryFn: async () => (INDEXER ? (await fetch(`${INDEXER}/funds`)).json() : []),
  });
  const funds: { id: string; name: string; pool: number; projects: string[] }[] = data ?? [];

  return (
    <section>
      <h1>Funds</h1>
      <p>Curated collections of projects. Each fund sets its own allocation rule: equal split, zoning, QF, or cap.</p>
      {funds.map((f) => (
        <div className="card" key={f.id}>
          <h3>{f.name}</h3>
          <div>pool: {f.pool}</div>
          <div>projects: {f.projects.length}</div>
        </div>
      ))}
      {funds.length === 0 && <div className="card">No active funds.</div>}
      <div className="card">
        <h3>Matching preview</h3>
        <p style={{ color: "#8b949e" }}>
          QF matches are computed from indexed contributions — reproducible, no netting.
        </p>
        <pre>{JSON.stringify(quadraticMatch([{ contributor: "0x1", project: "demo", amount: 4 }], 100), null, 2)}</pre>
      </div>
    </section>
  );
}
