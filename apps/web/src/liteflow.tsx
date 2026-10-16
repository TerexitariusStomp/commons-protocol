/**
 * Local implementation of the @liteflow/react hook surface used by this app.
 * (The upstream @liteflow/react package is unlicensed and bound to Liteflow's
 * hosted backend, so it is replaced here.)
 *
 * Auth:   wallet signature → indexer /auth → JWT (SIWE-lite)
 * Market: lssvm2 pools — a "listing" is a TOKEN-type pair, a "bid" is an
 *         NFT-type pair, checkout is a router swap. Offer ids encode
 *         `{chainId}-{pairAddress}`.
 */
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { isAddress } from 'viem'
import type { Signer } from './liteflow-signer'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ---------- config ----------

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

const FACTORY: Record<number, `0x${string}`> = JSON.parse(
  process.env.NEXT_PUBLIC_LSSVM_FACTORY || '{}',
)
const ROUTER: Record<number, `0x${string}`> = JSON.parse(
  process.env.NEXT_PUBLIC_LSSVM_ROUTER || '{}',
)
const LINEAR_CURVE: Record<number, `0x${string}`> = JSON.parse(
  process.env.NEXT_PUBLIC_LINEAR_CURVE || '{}',
)

// ---------- ABIs (minimal surfaces) ----------

const PAIR_ABI = [
  'function poolType() view returns (uint8)',
  'function nft() view returns (address)',
  'function token() view returns (address)',
  'function spotPrice() view returns (uint128)',
  'function withdrawERC20(address a, uint256 amount)',
  'function withdrawERC721(address a, uint256[] ids)',
  'function withdrawERC1155(address a, uint256[] ids, uint256[] amounts)',
  'function getBuyNFTQuote(uint256) view returns (uint8 err, uint256 input, uint256 protocolFee, uint256 royalty, uint256 total)',
  'function getSellNFTQuote(uint256 nftId, uint256 qty) view returns (uint8 err, uint256 output, uint256 protocolFee, uint256 royalty, uint256 total)',
] as const

const ROUTER_ABI = [
  'function swapERC20ForSpecificNFTs(tuple(address pair, uint256[] nftIds)[] swapList, uint256 inputAmount, address nftRecipient, uint256 deadline) returns (uint256)',
  'function swapETHForSpecificNFTs(tuple(address pair, uint256[] nftIds)[] swapList, address ethRecipient, address nftRecipient, uint256 deadline) payable returns (uint256)',
] as const

const FACTORY_ABI = [
  'function createPairERC1155ERC20(tuple(address token, address nft, address bondingCurve, address assetRecipient, uint8 poolType, uint128 delta, uint96 fee, uint128 spotPrice, uint256 nftId, uint256 initialNFTBalance, uint256 initialTokenBalance) params) returns (address)',
  'event NewPair(address indexed poolAddress)',
] as const

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const

const NFT_ABI = [
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
] as const

// ---------- context ----------

type LiteflowContextValue = { apiKey: string; endpoint?: string }
const LiteflowContext = createContext<LiteflowContextValue>({ apiKey: '' })

export const LiteflowProvider: FC<
  PropsWithChildren<{ apiKey: string; endpoint?: string }>
> = ({ apiKey, endpoint, children }) => (
  <LiteflowContext.Provider value={{ apiKey, endpoint }}>
    {children}
  </LiteflowContext.Provider>
)

// ---------- step enums ----------

export enum AcceptOfferStep {
  INITIAL,
  APPROVAL_SIGNATURE,
  APPROVAL_PENDING,
  TRANSACTION_SIGNATURE,
  TRANSACTION_PENDING,
  OWNERSHIP,
}
export enum CancelOfferStep {
  INITIAL,
  TRANSACTION_SIGNATURE,
  TRANSACTION_PENDING,
}
export enum CreateOfferStep {
  INITIAL,
  APPROVAL_SIGNATURE,
  APPROVAL_PENDING,
  SIGNATURE,
}
export enum CreateNftStep {
  INITIAL,
  UPLOAD,
  TRANSACTION_SIGNATURE,
  TRANSACTION_PENDING,
  LAZYMINT_SIGNATURE,
  LAZYMINT_PENDING,
  OWNERSHIP,
}
export enum MintDropStep {
  INITIAL,
  TRANSACTION_SIGNATURE,
  TRANSACTION_PENDING,
  OWNERSHIP,
}
export { BatchPurchaseStep } from './liteflow-batch'
import { BatchPurchaseStep } from './liteflow-batch'

// ---------- helpers ----------

function decodeOfferId(id: string): { chainId: number; pair: `0x${string}` } {
  const m = id.match(/^(\d+)[-:](0x[0-9a-fA-F]{40})/)
  if (!m || !m[1] || !m[2]) throw new Error(`Invalid offer id: ${id}`)
  return { chainId: parseInt(m[1], 10), pair: m[2] as `0x${string}` }
}

async function postJSON(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${INDEXER}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Indexer ${path} failed: ${res.status}`)
  return res.json()
}

function account(signer: Signer): `0x${string}` {
  const a = signer.account?.address
  if (!a) throw new Error('No account on signer')
  return a
}

// ---------- auth ----------

const jwtKey = (apiKey: string) => `liteflow-jwt:${apiKey}`
const loggedInCache = new Map<string, boolean>()

export function useIsLoggedIn(address: string): boolean {
  const { apiKey } = useContext(LiteflowContext)
  const addr = (address || '').toLowerCase()
  const [logged, setLogged] = useState<boolean>(
    () => loggedInCache.get(addr) || false,
  )
  useEffect(() => {
    if (!addr) return setLogged(false)
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(jwtKey(apiKey)) || ''
          : ''
      const payload = JSON.parse(atob(token.split('.')[1] || ''))
      const ok =
        payload?.address?.toLowerCase() === addr &&
        payload?.exp > Math.ceil(Date.now() / 1000)
      loggedInCache.set(addr, ok)
      setLogged(ok)
    } catch {
      loggedInCache.set(addr, false)
      setLogged(false)
    }
  }, [addr, apiKey])
  return logged
}

export function useAuthenticate(): [
  (signer: Signer) => Promise<{ jwtToken: string }>,
  {
    setAuthenticationToken: (t: string) => void
    resetAuthenticationToken: () => void
  },
] {
  const { apiKey } = useContext(LiteflowContext)
  const [, setToken] = useState<string>()

  const authenticate = useCallback(
    async (signer: Signer) => {
      const address = account(signer).toLowerCase()
      const { message } = await postJSON('/auth/nonce', { address })
      const signature = await signer.signMessage({
        account: signer.account!,
        message,
      })
      const { token } = await postJSON('/auth/verify', {
        address,
        message,
        signature,
      })
      if (typeof window !== 'undefined')
        localStorage.setItem(jwtKey(apiKey), token)
      loggedInCache.set(address, true)
      setToken(token)
      return { jwtToken: token }
    },
    [apiKey],
  )

  const setAuthenticationToken = useCallback(
    (t: string) => {
      if (typeof window !== 'undefined')
        localStorage.setItem(jwtKey(apiKey), t)
      setToken(t)
    },
    [apiKey],
  )
  const resetAuthenticationToken = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem(jwtKey(apiKey))
    loggedInCache.clear()
    setToken(undefined)
  }, [apiKey])

  return [authenticate, { setAuthenticationToken, resetAuthenticationToken }]
}

// ---------- marketplace actions ----------

/** Buy: accept a listing — swap currency for NFTs held by a TOKEN-type pair. */
export function useAcceptOffer(
  signer: Signer | undefined,
): [
  (offerId: string, quantity: BigNumberish) => Promise<void>,
  { activeStep: AcceptOfferStep; transactionHash?: string },
] {
  const [state, setState] = useState<{
    activeStep: AcceptOfferStep
    transactionHash?: string
  }>({ activeStep: AcceptOfferStep.INITIAL })

  const acceptOffer = useCallback(
    async (offerId: string, quantity: BigNumberish) => {
      if (!signer) throw new Error('No signer')
      const { chainId, pair } = decodeOfferId(offerId)
      const router = ROUTER[chainId]
      if (!router) throw new Error(`No router for chain ${chainId}`)
      const recipient = account(signer)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const qty = BigNumber.from(quantity).toBigInt()

      const token = (await signer.readContract({
        address: pair,
        abi: PAIR_ABI,
        functionName: 'token',
      })) as `0x${string}`
      const quote = (await signer.readContract({
        address: pair,
        abi: PAIR_ABI,
        functionName: 'getBuyNFTQuote',
        args: [qty],
      })) as [number, bigint, bigint, bigint, bigint]
      const total = quote[4]
      const { ids } = await postJSON('/pool/inventory', {
        chainId,
        pair,
        count: Number(qty),
      })

      if (token === ZERO_ADDRESS) {
        setState({ activeStep: AcceptOfferStep.TRANSACTION_SIGNATURE })
        const hash = await signer.writeContract({
          address: router,
          abi: ROUTER_ABI,
          functionName: 'swapETHForSpecificNFTs',
          args: [
            [{ pair, nftIds: ids.map((i: string) => BigNumber.from(i).toBigInt()) }],
            recipient,
            recipient,
            deadline,
          ],
          value: total,
          account: signer.account!,
          chain: signer.chain,
        })
        setState({
          activeStep: AcceptOfferStep.TRANSACTION_PENDING,
          transactionHash: hash,
        })
        await signer.waitForTransactionReceipt({ hash })
      } else {
        const allowance = (await signer.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [recipient, router],
        })) as bigint
        if (allowance < total) {
          setState({ activeStep: AcceptOfferStep.APPROVAL_SIGNATURE })
          const aHash = await signer.writeContract({
            address: token,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [router, total],
            account: signer.account!,
            chain: signer.chain,
          })
          setState({
            activeStep: AcceptOfferStep.APPROVAL_PENDING,
            transactionHash: aHash,
          })
          await signer.waitForTransactionReceipt({ hash: aHash })
        }
        setState({ activeStep: AcceptOfferStep.TRANSACTION_SIGNATURE })
        const hash = await signer.writeContract({
          address: router,
          abi: ROUTER_ABI,
          functionName: 'swapERC20ForSpecificNFTs',
          args: [
            [{ pair, nftIds: ids.map((i: string) => BigNumber.from(i).toBigInt()) }],
            total,
            recipient,
            deadline,
          ],
          account: signer.account!,
          chain: signer.chain,
        })
        setState({
          activeStep: AcceptOfferStep.TRANSACTION_PENDING,
          transactionHash: hash,
        })
        await signer.waitForTransactionReceipt({ hash })
      }
      setState((s) => ({ ...s, activeStep: AcceptOfferStep.OWNERSHIP }))
      setState({ activeStep: AcceptOfferStep.INITIAL })
    },
    [signer],
  )

  return [acceptOffer, state]
}

/** Cancel a listing/bid: owner withdraws all assets from their pair. */
export function useCancelOffer(
  signer: Signer | undefined,
): [
  (offerId: string) => Promise<void>,
  { activeStep: CancelOfferStep; transactionHash?: string },
] {
  const [state, setState] = useState<{
    activeStep: CancelOfferStep
    transactionHash?: string
  }>({ activeStep: CancelOfferStep.INITIAL })

  const cancelOffer = useCallback(
    async (offerId: string) => {
      if (!signer) throw new Error('No signer')
      const { pair } = decodeOfferId(offerId)
      const poolType = Number(
        await signer.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: 'poolType',
        }),
      )
      const nft = (await signer.readContract({
        address: pair,
        abi: PAIR_ABI,
        functionName: 'nft',
      })) as `0x${string}`
      const token = (await signer.readContract({
        address: pair,
        abi: PAIR_ABI,
        functionName: 'token',
      })) as `0x${string}`
      const recipient = account(signer)
      setState({ activeStep: CancelOfferStep.TRANSACTION_SIGNATURE })
      const hash =
        poolType === 1
          ? await signer.writeContract({
              address: pair,
              abi: PAIR_ABI,
              functionName: 'withdrawERC1155',
              args: [nft, [], []],
              account: signer.account!,
              chain: signer.chain,
            })
          : await signer.writeContract({
              address: pair,
              abi: [
                'function withdrawAllERC20(address a)',
              ] as const,
              functionName: 'withdrawAllERC20',
              args: [token],
              account: signer.account!,
              chain: signer.chain,
            })
      void recipient
      setState({
        activeStep: CancelOfferStep.TRANSACTION_PENDING,
        transactionHash: hash,
      })
      await signer.waitForTransactionReceipt({ hash })
      setState({ activeStep: CancelOfferStep.INITIAL })
    },
    [signer],
  )

  return [cancelOffer, state]
}

type CreateOfferParams = {
  type: 'BUY' | 'SALE'
  quantity: BigNumberish
  unitPrice: { amount: BigNumberish; currency: string | null }
  chain: number
  collection: string
  token: string
  expiredAt: Date
}

/**
 * List/bid: create a delta-0 lssvm2 pair.
 * SELL → TOKEN-type pair holding the NFT(s); BUY → NFT-type pair holding currency.
 */
export function useCreateOffer(
  signer: Signer | undefined,
): [
  (params: CreateOfferParams) => Promise<string>,
  { activeStep: CreateOfferStep; transactionHash?: string },
] {
  const [state, setState] = useState<{
    activeStep: CreateOfferStep
    transactionHash?: string
  }>({ activeStep: CreateOfferStep.INITIAL })

  const createOffer = useCallback(
    async (p: CreateOfferParams): Promise<string> => {
      if (!signer) throw new Error('No signer')
      const factory = FACTORY[p.chain]
      const curve = LINEAR_CURVE[p.chain]
      if (!factory || !curve) throw new Error(`No factory for chain ${p.chain}`)
      const owner = account(signer)
      const qty = BigNumber.from(p.quantity).toBigInt()
      const price = BigNumber.from(p.unitPrice.amount).toBigInt()
      const currency = (p.unitPrice.currency || ZERO_ADDRESS) as `0x${string}`
      const collection = p.collection as `0x${string}`

      const wait = async (hash: `0x${string}`) =>
        signer.waitForTransactionReceipt({ hash })

      if (p.type === 'SALE') {
        const approved = (await signer.readContract({
          address: collection,
          abi: NFT_ABI,
          functionName: 'isApprovedForAll',
          args: [owner, factory],
        })) as boolean
        if (!approved) {
          setState({ activeStep: CreateOfferStep.APPROVAL_SIGNATURE })
          const aHash = await signer.writeContract({
            address: collection,
            abi: NFT_ABI,
            functionName: 'setApprovalForAll',
            args: [factory, true],
            account: signer.account!,
            chain: signer.chain,
          })
          setState({
            activeStep: CreateOfferStep.APPROVAL_PENDING,
            transactionHash: aHash,
          })
          await wait(aHash)
        }
        setState({ activeStep: CreateOfferStep.SIGNATURE })
        const hash = await signer.writeContract({
          address: factory,
          abi: FACTORY_ABI,
          functionName: 'createPairERC1155ERC20',
          args: [
            {
              token: currency,
              nft: collection,
              bondingCurve: curve,
              assetRecipient: owner,
              poolType: 1, // TOKEN = sell-side listing
              delta: BigInt(0),
              fee: 0,
              spotPrice: price,
              nftId: BigNumber.from(p.token).toBigInt(),
              initialNFTBalance: qty,
              initialTokenBalance: BigInt(0),
            },
          ],
          account: signer.account!,
          chain: signer.chain,
        })
        const receipt = await wait(hash)
        const pair = parseNewPair(receipt)
        setState({ activeStep: CreateOfferStep.INITIAL })
        return `${p.chain}-${pair}`
      }

      // BUY bid: NFT-type pair holding currency
      const total = price * qty
      const allowance = (await signer.readContract({
        address: currency,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, factory],
      })) as bigint
      if (allowance < total) {
        setState({ activeStep: CreateOfferStep.APPROVAL_SIGNATURE })
        const aHash = await signer.writeContract({
          address: currency,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [factory, total],
          account: signer.account!,
          chain: signer.chain,
        })
        setState({
          activeStep: CreateOfferStep.APPROVAL_PENDING,
          transactionHash: aHash,
        })
        await wait(aHash)
      }
      setState({ activeStep: CreateOfferStep.SIGNATURE })
      const hash = await signer.writeContract({
        address: factory,
        abi: FACTORY_ABI,
        functionName: 'createPairERC1155ERC20',
        args: [
          {
            token: currency,
            nft: collection,
            bondingCurve: curve,
            assetRecipient: owner,
            poolType: 2, // NFT = buy-side bid
            delta: BigInt(0),
            fee: 0,
            spotPrice: price,
            nftId: BigNumber.from(p.token).toBigInt(),
            initialNFTBalance: BigInt(0),
            initialTokenBalance: total,
          },
        ],
        account: signer.account!,
        chain: signer.chain,
      })
      const receipt = await wait(hash)
      const pair = parseNewPair(receipt)
      setState({ activeStep: CreateOfferStep.INITIAL })
      return `${p.chain}-${pair}`
    },
    [signer],
  )

  return [createOffer, state]
}

function parseNewPair(receipt: { logs: { topics: string[] }[] }): string {
  for (const log of receipt.logs || []) {
    const t = log.topics?.[1]
    if (t) {
      const a = '0x' + t.slice(-40)
      if (isAddress(a)) return a
    }
  }
  throw new Error('Could not determine created pair address')
}

/** Cart checkout: one router call across multiple pairs. */
export function useBatchPurchase(
  signer: Signer | undefined,
): [
  (items: { offerId: string; quantity: BigNumberish }[]) => Promise<string>,
  { activeStep: BatchPurchaseStep; transactionHash?: string },
] {
  const [state, setState] = useState<{
    activeStep: BatchPurchaseStep
    transactionHash?: string
  }>({ activeStep: BatchPurchaseStep.INITIAL })

  const batchPurchase = useCallback(
    async (items: { offerId: string; quantity: BigNumberish }[]) => {
      if (!signer) throw new Error('No signer')
      const recipient = account(signer)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const { chainId } = decodeOfferId(items[0]?.offerId || '')
      const router = ROUTER[chainId]
      if (!router) throw new Error(`No router for chain ${chainId}`)

      const swapList: { pair: `0x${string}`; nftIds: bigint[] }[] = []
      let total = BigInt(0)
      let currency: `0x${string}` = ZERO_ADDRESS
      for (const item of items) {
        const { pair } = decodeOfferId(item.offerId)
        currency = (await signer.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: 'token',
        })) as `0x${string}`
        const qty = BigNumber.from(item.quantity).toBigInt()
        const quote = (await signer.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: 'getBuyNFTQuote',
          args: [qty],
        })) as [number, bigint, bigint, bigint, bigint]
        total += quote[4]
        const { ids } = await postJSON('/pool/inventory', {
          chainId,
          pair,
          count: Number(qty),
        })
        swapList.push({ pair, nftIds: ids.map((i: string) => BigNumber.from(i).toBigInt()) })
      }

      setState({ activeStep: BatchPurchaseStep.TRANSACTION_SIGNATURE })
      const hash =
        currency === ZERO_ADDRESS
          ? await signer.writeContract({
              address: router,
              abi: ROUTER_ABI,
              functionName: 'swapETHForSpecificNFTs',
              args: [swapList, recipient, recipient, deadline],
              value: total,
              account: signer.account!,
              chain: signer.chain,
            })
          : await signer.writeContract({
              address: router,
              abi: ROUTER_ABI,
              functionName: 'swapERC20ForSpecificNFTs',
              args: [swapList, total, recipient, deadline],
              account: signer.account!,
              chain: signer.chain,
            })
      setState({
        activeStep: BatchPurchaseStep.TRANSACTION_PENDING,
        transactionHash: hash,
      })
      await signer.waitForTransactionReceipt({ hash })
      setState({ activeStep: BatchPurchaseStep.INITIAL })
      return hash
    },
    [signer],
  )

  return [batchPurchase, state]
}

// ---------- minting / drops / invitations / account ----------

export function useCreateNFT(_signer: Signer | undefined): [
  (input: any, t?: any) => Promise<string>,
  { activeStep: CreateNftStep; transactionHash?: string },
] {
  const [state] = useState({ activeStep: CreateNftStep.INITIAL })
  const createNFT = useCallback(async () => {
    throw new Error('Minting is not enabled on Commons yet')
  }, [])
  return [createNFT, state]
}

export function useMintDrop(_signer: Signer | undefined): [
  (dropId: string, qty: number) => Promise<any[]>,
  { activeStep: MintDropStep; transactionHash?: string },
] {
  const [state] = useState({ activeStep: MintDropStep.INITIAL })
  const mintDrop = useCallback(async () => {
    throw new Error('Drops are not enabled on Commons yet')
  }, [])
  return [mintDrop, state]
}

export function useInvitation(_signer: Signer | undefined): {
  create: () => Promise<string>
  accept: (id: string) => Promise<void>
  creating: boolean
} {
  const [creating, setCreating] = useState(false)
  const create = useCallback(async () => {
    setCreating(true)
    try {
      const { id } = await postJSON('/invitations', {})
      return id as string
    } finally {
      setCreating(false)
    }
  }, [])
  const accept = useCallback(async (id: string) => {
    await postJSON(`/invitations/${id}/accept`, {})
  }, [])
  return { create, accept, creating }
}

export function useUpdateAccount(_signer: Signer | undefined): [
  (data: any) => Promise<string>,
  unknown,
] {
  const update = useCallback(async (data: any) => {
    const { address } = await postJSON('/accounts', data)
    return address as string
  }, [])
  return [update, {}]
}
