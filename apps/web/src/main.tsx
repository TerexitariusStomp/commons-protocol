import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./lib/config";
import App from "./App";
import "./index.css";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
