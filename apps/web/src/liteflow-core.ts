/**
 * Local implementation of the @liteflow/core surface used by this app.
 * (Upstream package is unlicensed → replaced.)
 */
import { getAddress } from 'viem'
import type { Signer } from './liteflow-signer'

export type { Signer }
export type TransactionHash = `0x${string}`
export type UUID = string
export type Address = `0x${string}`

/** Normalize to a checksummed address. */
export function toAddress(address: string): Address {
  return getAddress(address)
}

export function toTransactionHash(hash: string): TransactionHash {
  return hash as TransactionHash
}
