import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Progress,
  SimpleGrid,
  SkeletonText,
  Text,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Head from '../../components/Head'
import Link from '../../components/Link/Link'
import LargeLayout from '../../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''
const PRESETS = [10, 100, 1000]

type FundDetail = {
  id: string
  name: string
  description: string | null
  mechanism: string | null
  status: string | null
  pledge_goal: number | null
  points_goal: number | null
  memberProjects: {
    project: string
    name: string | null
    description: string | null
    status: string
    artifacts: number
  }[]
  seasonPoints: number
  pledged: number
  matchPreview: { demand: number; coverage: number }
}

const FundDetailPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { query } = useRouter()
  const id = typeof query.id === 'string' ? query.id : ''
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const toast = useToast()
  const [fund, setFund] = useState<FundDetail | null>()
  const [balance, setBalance] = useState<number | undefined>()
  const [pledgeAmt, setPledgeAmt] = useState(50)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!INDEXER || !id) return
    fetch(`${INDEXER}/funds/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFund)
      .catch(() => setFund(null))
  }, [id])

  useEffect(() => {
    if (!INDEXER || !address) return
    fetch(`${INDEXER}/points/${address}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balance))
      .catch(() => {})
  }, [address])

  const givePoints = async (amount: number) => {
    if (!address || !fund) return
    setBusy(`pts${amount}`)
    try {
      const seasonRes = await fetch(`${INDEXER}/season`).then((r) => r.json())
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons allocate points\nWallet: ${address.toLowerCase()}\nFund: ${fund.id}\nAmount: ${amount}\nSeason: ${seasonRes.id}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/points/allocate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: address, fundId: fund.id, amount, ts, signature }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      setBalance(body.balance)
      toast({ title: t('fund.gavePoints', { amount }), status: 'success' })
    } catch (e) {
      toast({
        title: t('fund.giveError'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  const pledge = async () => {
    if (!address || !fund) return
    setBusy('pledge')
    try {
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons pledge\nFund: ${fund.id}\nAmount USD: ${pledgeAmt}\nWallet: ${address.toLowerCase()}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/pledges`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: address, fundId: fund.id, amountUsd: pledgeAmt, ts, signature }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      toast({ title: t('project.pledged', { amount: pledgeAmt }), status: 'success' })
    } catch (e) {
      toast({
        title: t('project.pledgeError'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setBusy(null)
    }
  }

  const mechLabel = (m: string | null) =>
    m === 'qf'
      ? t('how.mech.qf.name')
      : m === 'match'
        ? t('how.mech.match.name')
        : m === 'multiplier'
          ? t('how.mech.multiplier.name')
          : m === 'artizen'
            ? t('fund.artizen')
            : m

  return (
    <LargeLayout>
      <Head title={fund?.name ?? id} description={fund?.description ?? undefined} />
      <Box py={8}>
        {fund === undefined ? (
          <SkeletonText noOfLines={3} spacing={4} />
        ) : fund === null ? (
          <Heading variant="heading1">{t('fund.notFound')}</Heading>
        ) : (
          <>
            <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
              <Box maxW="3xl">
                <Flex align="center" gap={3} flexWrap="wrap">
                  <Heading variant="title" fontSize={{ base: '2xl', md: '4xl' }}>
                    {fund.name}
                  </Heading>
                  {fund.status === 'proposed' && (
                    <Badge colorScheme="purple">{t('fund.proposed')}</Badge>
                  )}
                  <Badge variant="outline" colorScheme="brand">
                    {mechLabel(fund.mechanism)}
                  </Badge>
                </Flex>
                {fund.description && (
                  <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
                    {fund.description}
                  </Text>
                )}
                <Flex gap={6} mt={4} fontSize="sm" color="gray.600" flexWrap="wrap">
                  <Text>
                    <Text as="span" fontWeight="bold" color="brand.black">
                      {fund.memberProjects.length}
                    </Text>{' '}
                    {t('fund.memberProjects')}
                  </Text>
                  <Text>
                    <Text as="span" fontWeight="bold" color="brand.black">
                      ${fund.pledged.toLocaleString()}
                    </Text>{' '}
                    {t('fund.pledged')}
                  </Text>
                  <Text>
                    <Text as="span" fontWeight="bold" color="brand.black">
                      {fund.seasonPoints.toLocaleString()}
                    </Text>{' '}
                    {t('fund.seasonPoints')}
                  </Text>
                </Flex>
                {fund.pledge_goal != null && fund.pledge_goal > 0 && (
                  <Box mt={4} maxW="md">
                    <Progress
                      value={Math.min(100, (fund.pledged / fund.pledge_goal) * 100)}
                      colorScheme="brand"
                      rounded="full"
                      size="sm"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      ${fund.pledged.toLocaleString()} / ${fund.pledge_goal.toLocaleString()}
                    </Text>
                  </Box>
                )}
              </Box>
              <Flex direction="column" gap={3} minW="240px" p={5} rounded="2xl" borderWidth="1px" bg="white" shadow="sm">
                <Text fontSize="xs" fontWeight="bold" color="gray.500">
                  {t('fund.givePoints')}
                  {balance !== undefined && ` · ${t('fund.yourBalance', { balance })}`}
                </Text>
                <Flex gap={2}>
                  {PRESETS.map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant="outline"
                      colorScheme="brand"
                      rounded="full"
                      flex={1}
                      isLoading={busy === `pts${amt}`}
                      isDisabled={!address || (balance !== undefined && amt > balance)}
                      onClick={() => givePoints(amt)}
                    >
                      +{amt}
                    </Button>
                  ))}
                </Flex>
                <Text fontSize="xs" fontWeight="bold" color="gray.500" mt={2}>
                  {t('project.pledgeLabel')}
                </Text>
                <Flex gap={2}>
                  <InputGroup size="sm">
                    <InputLeftElement pointerEvents="none" color="gray.500">
                      $
                    </InputLeftElement>
                    <Input
                      type="number"
                      min={1}
                      value={pledgeAmt}
                      onChange={(e) => setPledgeAmt(Math.max(0, Number(e.target.value) || 0))}
                      rounded="lg"
                    />
                  </InputGroup>
                  <Button
                    size="sm"
                    colorScheme="brand"
                    variant="outline"
                    rounded="lg"
                    isLoading={busy === 'pledge'}
                    isDisabled={!address}
                    onClick={pledge}
                  >
                    {t('project.pledge')}
                  </Button>
                </Flex>
                <Text fontSize="2xs" color="gray.400">
                  {t('project.pledgeNote')}
                </Text>
              </Flex>
            </Flex>

            <Heading variant="heading2" mt={10} mb={4}>
              {t('fund.projects', { count: fund.memberProjects.length })}
            </Heading>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
              {fund.memberProjects.map((p) => (
                <Link key={p.project} href={`/projects/${p.project}`}>
                  <Box p={5} rounded="2xl" borderWidth="1px" bg="white" h="full" _hover={{ borderColor: 'brand.500' }}>
                    <Flex justify="space-between" gap={2}>
                      <Text fontWeight="semibold" noOfLines={1}>
                        {p.name ?? p.project}
                      </Text>
                      {p.status === 'claimed' && <Badge colorScheme="green">{t('explore.projects.claimed')}</Badge>}
                    </Flex>
                    {p.description && (
                      <Text fontSize="xs" color="gray.600" mt={1} noOfLines={2}>
                        {p.description}
                      </Text>
                    )}
                    <Text fontSize="2xs" color="gray.500" mt={2}>
                      {t('explore.projects.artifacts', { count: p.artifacts })}
                    </Text>
                  </Box>
                </Link>
              ))}
            </SimpleGrid>
          </>
        )}
      </Box>
    </LargeLayout>
  )
}

export default FundDetailPage
