import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Progress,
  Text,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Head from '../components/Head'
import Link from '../components/Link/Link'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''
const PRESETS = [10, 100, 1000]

type Fund = {
  id: string
  name: string
  mechanism: string | null
  status: string | null
  points_goal: number | null
}
type Season = {
  id: number
  daysLeft: number
  totals: Record<string, number>
  backingTotals: Record<string, number>
}
type PointsData = {
  balance: number
  gifts: { fund_id: string; amount: number }[]
}

const AllocatePage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const toast = useToast()
  const [funds, setFunds] = useState<Fund[]>([])
  const [season, setSeason] = useState<Season | undefined>()
  const [me, setMe] = useState<PointsData | undefined>()
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!INDEXER) return
    Promise.all([
      fetch(`${INDEXER}/funds`).then((r) => r.json()),
      fetch(`${INDEXER}/season`).then((r) => r.json()),
    ])
      .then(([f, s]) => {
        setFunds(f)
        setSeason(s)
      })
      .catch(() => {})
  }, [])

  const loadMe = () => {
    if (!INDEXER || !address) return
    fetch(`${INDEXER}/points/${address}`)
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {})
  }
  useEffect(loadMe, [address])

  const totalPts = Object.values(season?.totals ?? {}).reduce((a, b) => a + b, 0)
  const myGifts = new Map((me?.gifts ?? []).map((g) => [g.fund_id, g.amount]))

  const give = async (fundId: string, amount: number) => {
    if (!address || !season) return
    setBusy(`${fundId}:${amount}`)
    try {
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons allocate points\nWallet: ${address.toLowerCase()}\nFund: ${fundId}\nAmount: ${amount}\nSeason: ${season.id}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/points/allocate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: address, fundId, amount, ts, signature }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      setMe((m) => m && { ...m, balance: body.balance })
      loadMe()
      fetch(`${INDEXER}/season`).then((r) => r.json()).then(setSeason).catch(() => {})
      toast({ title: t('allocate.gave', { amount }), status: 'success' })
    } catch (e) {
      toast({
        title: t('allocate.error'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  const row = (f: Fund, proposed: boolean) => {
    const pts = proposed
      ? season?.backingTotals?.[f.id] ?? 0
      : season?.totals[f.id] ?? 0
    const share = totalPts > 0 ? (pts / totalPts) * 100 : 0
    const mine = myGifts.get(f.id) ?? 0
    return (
      <Flex
        key={f.id}
        direction={{ base: 'column', md: 'row' }}
        align={{ md: 'center' }}
        gap={4}
        px={5}
        py={4}
        bg="white"
        borderWidth="1px"
        rounded="2xl"
      >
        <Box flex={1} minW={0}>
          <Flex align="center" gap={2}>
            <Link href={`/funds/${f.id}`}>
              <Text fontWeight="semibold" noOfLines={1} _hover={{ textDecor: 'underline' }}>
                {f.name}
              </Text>
            </Link>
            <Badge variant="outline" colorScheme="brand" fontSize="2xs">
              {f.mechanism ?? 'qf'}
            </Badge>
            {proposed && <Badge colorScheme="purple">{t('fund.proposed')}</Badge>}
          </Flex>
          {proposed ? (
            <Box mt={2} maxW="sm">
              <Progress
                value={f.points_goal ? Math.min(100, (pts / f.points_goal) * 100) : 0}
                size="xs"
                colorScheme="purple"
                rounded="full"
              />
              <Text fontSize="2xs" color="gray.500" mt={1}>
                {pts.toLocaleString()} / {(f.points_goal ?? 0).toLocaleString()} {t('allocate.toLaunch')}
              </Text>
            </Box>
          ) : (
            <Text fontSize="xs" color="gray.500" mt={1}>
              {pts.toLocaleString()} {t('allocate.seasonPts')} · {share.toFixed(1)}% {t('allocate.ofPool')}
            </Text>
          )}
        </Box>
        <Text fontSize="xs" color="gray.500" w={20} textAlign={{ md: 'right' }}>
          {mine > 0 ? `+${mine.toLocaleString()} ${t('allocate.mine')}` : ''}
        </Text>
        <Flex gap={2}>
          {PRESETS.map((amt) => (
            <Button
              key={amt}
              size="sm"
              variant="outline"
              colorScheme="brand"
              rounded="full"
              minW={14}
              isLoading={busy === `${f.id}:${amt}`}
              isDisabled={!address || (me !== undefined && amt > me.balance)}
              onClick={() => give(f.id, amt)}
            >
              +{amt}
            </Button>
          ))}
        </Flex>
      </Flex>
    )
  }

  const active = funds.filter((f) => f.status !== 'proposed')
  const proposed = funds.filter((f) => f.status === 'proposed')

  return (
    <LargeLayout>
      <Head title={t('allocate.title')} />
      <Box py={10} maxW="4xl" mx="auto">
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={4} mb={2}>
          <Box>
            <Heading variant="title">{t('allocate.title')}</Heading>
            <Text color="gray.600" mt={2} fontSize="sm">
              {t('allocate.sub', { season: season?.id ?? '—', days: season?.daysLeft ?? '—' })}
            </Text>
          </Box>
          <Flex align="center" gap={4}>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="extrabold" color="brand.600">
                {me ? me.balance.toLocaleString() : '—'}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {t('points.balance')}
              </Text>
            </Box>
          </Flex>
        </Flex>
        {!address && (
          <Text color="gray.500" fontSize="sm" mb={4}>
            {t('points.connect')}
          </Text>
        )}
        <Flex direction="column" gap={3} mt={6}>
          {active.map((f) => row(f, false))}
        </Flex>
        {proposed.length > 0 && (
          <>
            <Divider my={8} />
            <Heading variant="heading2" mb={1}>
              {t('allocate.proposed')}
            </Heading>
            <Text fontSize="xs" color="gray.500" mb={4}>
              {t('allocate.proposedDesc')}
            </Text>
            <Flex direction="column" gap={3}>
              {proposed.map((f) => row(f, true))}
            </Flex>
          </>
        )}
      </Box>
    </LargeLayout>
  )
}

export default AllocatePage
