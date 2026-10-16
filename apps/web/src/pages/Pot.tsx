import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { useState } from "react";
import { POT_ABI } from "../lib/abis";
import { ADDRESSES } from "../lib/config";

export default function Pot() {
  const { address } = useAccount();
  const pot = ADDRESSES.pot as `0x${string}`;
  const [amt, setAmt] = useState("");

  const { data: totalAssets } = useReadContract({
    address: pot,
    abi: POT_ABI,
    functionName: "totalAssets",
    query: { enabled: !!pot },
  });
  const { data: supply } = useReadContract({
    address: pot,
    abi: POT_ABI,
    functionName: "totalSupply",
    query: { enabled: !!pot },
  });
  const { writeContractAsync } = useWriteContract();

  const deposit = async () => {
    if (!address || !amt) return;
    await writeContractAsync({
      address: pot,
      abi: POT_ABI,
      functionName: "deposit",
      args: [BigInt(amt), address],
    });
  };

  return (
    <section>
      <h1>The Pot</h1>
      <p>Hold-or-Exit endowment. Marketplace and pool fees grow every share; redeem to exit and burn.</p>
      <div className="grid">
        <div className="card">
          <div className="stat">{totalAssets?.toString() ?? "—"}</div>
          <div>total assets</div>
        </div>
        <div className="card">
          <div className="stat">{supply?.toString() ?? "—"}</div>
          <div>shares</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <label>Deposit amount (stable, wei)</label>
        <input value={amt} onChange={(e) => setAmt(e.target.value)} />
        <button style={{ marginTop: 12 }} disabled={!address || !pot} onClick={deposit}>
          Deposit
        </button>
      </div>
    </section>
  );
}
