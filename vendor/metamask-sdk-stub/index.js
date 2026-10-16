export default class MetaMaskSDK {
  constructor() {
    throw new Error(
      "@metamask/sdk is excluded from this build (ConsenSys non-commercial license). Use the injected or walletConnect connectors instead.",
    );
  }
}
