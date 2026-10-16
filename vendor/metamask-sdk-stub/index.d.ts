export interface MetaMaskSDKOptions {
  [key: string]: unknown;
}
export interface SDKProvider {
  [key: string]: unknown;
}
declare class MetaMaskSDK {
  constructor(options?: MetaMaskSDKOptions);
}
export default MetaMaskSDK;
