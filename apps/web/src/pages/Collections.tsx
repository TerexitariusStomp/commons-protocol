import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const INDEXER = import.meta.env.VITE_INDEXER ?? "";

interface PoolRow {
  pair: string;
  nft: string;
  nftId?: string;
  token: string;
  spotPrice: string;
  nftsHeld: number;
  tokenBalance: string;
  name?: string;
}

export default function Collections() {
  const { data } = useQuery({
    queryKey: ["pools"],
    queryFn: async () => (INDEXER ? (await fetch(`${INDEXER}/pools`)).json() : []),
    refetchInterval: 30_000,
  });
  const pools: PoolRow[] = data ?? [];

  return (
    <section>
      <h1>Collections</h1>
      <p>
        Every listing trades through a liquidity pool: sell instantly to the pool or buy from it. Pool fees feed the
        Commons Pot, which funds public goods.
      </p>
      <div className="grid">
        {pools.map((p) => (
          <Link to={`/collection/${p.pair}`} key={p.pair} className="card">
            <h3>{p.name ?? `${p.nft.slice(0, 8)}…${p.nftId ? ` #${p.nftId}` : ""}`}</h3>
            <div>floor {p.spotPrice}</div>
            <div>
              depth {p.nftsHeld} NFTs · {p.tokenBalance}
            </div>
          </Link>
        ))}
        {pools.length === 0 && <div className="card">No pools indexed yet.</div>}
      </div>
    </section>
  );
}
