import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Head from '../../components/Head'
import useEnvironment from '../../hooks/useEnvironment'
import LargeLayout from '../../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type Claim = {
  project: string
  name: string | null
  description: string | null
  shortfall: string | null
  status: string
  royalty_bps: number | null
}

const ClaimProjectPage: NextPage = () => {
  const env = useEnvironment()
  const toast = useToast()
  const { query } = useRouter()
  const slug = typeof query.slug === 'string' ? query.slug : undefined
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [claim, setClaim] = useState<Claim | undefined>()
  const [bps, setBps] = useState(500)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!INDEXER || !slug) return
    fetch(`${INDEXER}/claims`)
      .then((r) => r.json())
      .then((rows: Claim[]) =>
        setClaim(rows.find((c) => c.project === slug)),
      )
      .catch(() => setClaim(undefined))
  }, [slug])

  const finalize = async () => {
    if (!address || !slug || !claim) return
    setBusy(true)
    try {
      const message = `Commons claim\nProject: ${slug}\nWallet: ${address}\nRoyalty bps: ${bps}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/claims/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project: slug,
          wallet: address,
          royaltyBps: bps,
          signature,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      toast({ title: 'Project claimed', status: 'success' })
      setClaim({ ...claim, status: 'claimed' })
    } catch (e) {
      toast({
        title: 'Claim failed',
        description: e instanceof Error ? e.message : String(e),
        status: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <LargeLayout>
      <Head title={`Claim ${claim?.name ?? slug ?? ''} — ${env.META_TITLE}`} />
      <Box mb={8}>
        <Heading as="h1" size="xl" mb={2}>
          {claim?.name ?? slug ?? 'Project'}
        </Heading>
        {claim?.description && (
          <Text color="gray.600" maxW="2xl" mb={3}>
            {claim.description}
          </Text>
        )}
        <Text color="gray.500" maxW="2xl">
          Link the project treasury wallet and choose the share of artifact
          sales routed to it. Unclaimed proceeds are escrowed by the Pot.
        </Text>
      </Box>
      {claim === undefined ? (
        <Text color="gray.500">Loading…</Text>
      ) : (
        <Card maxW="lg">
          <CardBody>
            <Badge
              mt={2}
              colorScheme={claim.status === 'claimed' ? 'green' : 'yellow'}
            >
              {claim.status}
            </Badge>
            {claim.status !== 'claimed' && (
              <Box mt={6}>
                <Text variant="subtitle2" mb={2}>
                  Sale share to this project: {(bps / 100).toFixed(1)}%
                </Text>
                <Slider
                  min={0}
                  max={500}
                  step={25}
                  value={bps}
                  onChange={setBps}
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
                <Button
                  mt={6}
                  colorScheme="brand"
                  isLoading={busy}
                  isDisabled={!address}
                  onClick={finalize}
                >
                  {address ? 'Sign & claim' : 'Connect wallet to claim'}
                </Button>
              </Box>
            )}
          </CardBody>
        </Card>
      )}
    </LargeLayout>
  )
}

export default ClaimProjectPage
