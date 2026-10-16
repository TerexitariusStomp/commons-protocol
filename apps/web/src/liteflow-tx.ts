/**
 * sendTransaction — submits a raw transaction described by the API
 * (to/data/value) through the user's wallet.
 */
import type { Signer } from './liteflow-signer'

type ApiTransaction = {
  data?: string | null
  from?: string | null
  gasPrice?: string | null
  to?: string | null
  value?: string | null
}

export async function sendTransaction(
  signer: Signer,
  transaction: ApiTransaction,
): Promise<{ hash: `0x${string}` }> {
  if (!signer.account) throw new Error('No account on signer')
  if (!transaction.to) throw new Error('Transaction missing `to`')
  const hash = await signer.sendTransaction({
    account: signer.account,
    to: transaction.to as `0x${string}`,
    data: (transaction.data || undefined) as `0x${string}` | undefined,
    value: transaction.value ? BigInt(transaction.value) : undefined,
  })
  return { hash }
}
