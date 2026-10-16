import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { PAIR_ABI } from "../lib/abis";

const INDEXER = import.meta.env.VITE_INDEXER ?? "";

export default function Collection() {
  const { addr } = useParams<{ addr: string }>();
  const pair = addr as `0x${string}`;
  const { address } = useAccount();

  const { data: poolMeta } = useQuery({
    queryKey: ["pool", pair],
    queryFn: async () => (INDEXER ? (await fetch(`${INDEXER}/pools/${pair}`)).json() : null),
    enabled: !!INDEXER,
  });

  const { data: spot } = useReadContract({ address: pair, abi: PAIR_ABI, functionName: "spotPrice" });
  const { data: sellQuote } = useReadContract({
    address: pair,
    abi: PAIR_ABI,
    functionName: "getSellNFTQuote",
    args: [1n],
  });
  const { data: buyQuote } = useReadContract({
    address: pair,
    abi: PAIR_ABI,
    functionName: "getBuyNFTQuote",
    args: [1n],
  });
  const { writeContractAsync } = useWriteContract();

  const sell = async () => {
    // Sell-to-pool: actual swap goes through LSSVMRouter.swapNFTsForToken;
    // UI wires the router call here once pool params are known.
    void writeContractAsync;
  };

  return (
    <section>
      <h1>{poolMeta?.name ?? `Collection ${pair.slice(0, 10)}…`}</h1>
      <div className="card">
        <div className="stat">{spot ? spot.toString() : "—"}</div>
        <div>fixed pool price (settlement token wei)</div>
        {buyQuote && <div>buy 1 → {buyQuote[3].toString()} (incl. fees + royalty)</div>}
        {sellQuote && <div>sell 1 → {sellQuote[3].toString()} (net of fees + royalty)</div>}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button disabled={!address} onClick={sell}>
          Sell to pool
        </button>
        <button disabled={!address}>Buy from pool</button>
      </div>
      {poolMeta?.project && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>About this project</h3>
          <p>{poolMeta.project.description ?? "Archived Artizen project page."}</p>
        </div>
      )}
    </section>
  );
}
