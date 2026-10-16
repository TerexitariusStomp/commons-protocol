import { NavLink, Route, Routes } from "react-router-dom";
import { useAccount } from "wagmi";
import Collections from "./pages/Collections";
import Collection from "./pages/Collection";
import Pot from "./pages/Pot";
import Funds from "./pages/Funds";
import Claim from "./pages/Claim";

export default function App() {
  const { address } = useAccount();
  return (
    <div className="app">
      <header>
        <NavLink to="/" className="brand">
          Commons
        </NavLink>
        <nav>
          <NavLink to="/">Collections</NavLink>
          <NavLink to="/pot">Pot</NavLink>
          <NavLink to="/funds">Funds</NavLink>
          <NavLink to="/claim">Claim</NavLink>
        </nav>
        <div className="acct">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}</div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Collections />} />
          <Route path="/collection/:addr" element={<Collection />} />
          <Route path="/pot" element={<Pot />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/claim" element={<Claim />} />
        </Routes>
      </main>
    </div>
  );
}
