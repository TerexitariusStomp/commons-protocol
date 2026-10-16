import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

const INDEXER = import.meta.env.VITE_INDEXER ?? "";

export default function Claim() {
  const { address } = useAccount();
  const { data } = useQuery({
    queryKey: ["claims", address],
    queryFn: async () =>
      INDEXER && address ? (await fetch(`${INDEXER}/claims?wallet=${address}`)).json() : [],
    enabled: !!INDEXER && !!address,
  });
  const claims: { project: string; shortfall: number; status: string }[] = data ?? [];

  return (
    <section>
      <h1>Claim your place</h1>
      <p>
        Artizen projects are pre-loaded on the graph. Add the Commons bot to your project's Telegram channel to start a
        consent-based claim. The window is open for six months; unclaimed shares stay with the Pot.
      </p>
      {claims.map((c) => (
        <div className="card" key={c.project}>
          <h3>{c.project}</h3>
          <div>rescue target: {c.shortfall}</div>
          <div>status: {c.status}</div>
        </div>
      ))}
      {!address && <div className="card">Connect a wallet to see claimable projects.</div>}
    </section>
  );
}
