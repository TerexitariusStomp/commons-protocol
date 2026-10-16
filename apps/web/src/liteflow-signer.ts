/**
 * Signer type: a viem WalletClient extended with publicActions
 * (same shape as @liteflow/core's Signer).
 */
import type {
  Account,
  Chain,
  PublicActions,
  Transport,
  WalletClient,
} from 'viem'

export type Signer<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
> = WalletClient<TTransport, TChain, TAccount> &
  PublicActions<TTransport, TChain, TAccount>
