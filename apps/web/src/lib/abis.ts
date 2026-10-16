// Minimal ABIs for the Commons liquidity layer (sudoswap lssvm2 interfaces).

export const PAIR_ABI = [
  {
    name: "spotPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint128" }],
  },
  { name: "delta", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { name: "fee", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint96" }] },
  {
    name: "getAllHeldIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "getBuyNFTQuote",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "numNFTs", type: "uint256" }],
    outputs: [
      { name: "error", type: "uint8" },
      { name: "newSpotPrice", type: "uint128" },
      { name: "newDelta", type: "uint128" },
      { name: "inputAmount", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "royaltyAmount", type: "uint256" },
    ],
  },
  {
    name: "getSellNFTQuote",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "numNFTs", type: "uint256" }],
    outputs: [
      { name: "error", type: "uint8" },
      { name: "newSpotPrice", type: "uint128" },
      { name: "newDelta", type: "uint128" },
      { name: "outputAmount", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "royaltyAmount", type: "uint256" },
    ],
  },
] as const;

export const POT_ABI = [
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
