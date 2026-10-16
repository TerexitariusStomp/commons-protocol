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
import SkeletonGrid from '../../components/Skeleton/Grid'
import SkeletonTokenCard from '../../components/Skeleton/TokenCard'
import TokenCard from '../../components/Token/Card'
import {
  AssetCondition,
  useFetchAllErc721And1155Query,
} from '../../src/graphql'
import LargeLayout from '../../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type ProjectDetail = {
  project: string
  name: string | null
  description: string | null
  status: string
  royalty_bps: number | null
  wallet: string | null
  goal: number | null
  artifacts: { token_id: string }[]
  funds: { id: string; name: string }[]
  pledged: number
}

const ProjectDetailPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { query } = useRouter()
  const slug = typeof query.slug === 'string' ? query.slug : ''
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const toast = useToast()
  const [detail, setDetail] = useState<ProjectDetail | null>()
  const [amount, setAmount] = useState(25)
  const [pledging, setPledging] = useState(false)

  useEffect(() => {
    if (!INDEXER || !slug) return
    fetch(`${INDEXER}/projects/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [slug])

  const traitValue = detail?.name ?? detail?.project
  const { data: assetsData } = useFetchAllErc721And1155Query({
    variables: {
      address: address || '',
      limit: 12,
      offset: 0,
      orderBy: null,
      condition: traitValue
        ? ({
            traits: [{ type: 'Project', values: [traitValue] }],
          } as AssetCondition)
        : null,
    },
    skip: !traitValue,
  })
  const assets = assetsData?.assets?.nodes

  const pledge = async () => {
    if (!address || !detail) return
    setPledging(true)
    try {
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons pledge\nProject: ${detail.project}\nAmount USD: ${amount}\nWallet: ${address.toLowerCase()}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/pledges`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          project: detail.project,
          amountUsd: amount,
          ts,
          signature,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      toast({ title: t('project.pledged', { amount }), status: 'success' })
    } catch (e) {
      toast({
        title: t('project.pledgeError'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setPledging(false)
    }
  }

  return (
    <LargeLayout>
      <Head title={detail?.name ?? slug} description={detail?.description ?? undefined} />
      <Box py={8}>
        {detail === undefined ? (
          <SkeletonText noOfLines={3} spacing={4} />
        ) : detail === null ? (
          <Heading variant="heading1">{t('project.notFound')}</Heading>
        ) : (
          <>
            <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
              <Box maxW="3xl">
                <Flex align="center" gap={3} flexWrap="wrap">
                  <Heading variant="title" fontSize={{ base: '2xl', md: '4xl' }}>
                    {detail.name ?? detail.project}
                  </Heading>
                  <Badge
                    colorScheme={detail.status === 'claimed' ? 'green' : 'yellow'}
                    fontSize="sm"
                  >
                    {detail.status}
                  </Badge>
                  {detail.funds.map((f) => (
                    <Badge key={f.id} as={Link} href={`/funds/${f.id}`} variant="outline" colorScheme="brand">
                      {f.name}
                    </Badge>
                  ))}
                </Flex>
                {detail.description && (
                  <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
                    {detail.description}
                  </Text>
                )}
                <Text color="brand.600" fontWeight="semibold" mt={3} fontSize="sm">
                  {t('project.royalty', {
                    pct: ((detail.royalty_bps ?? 1000) / 100).toString(),
                  })}
                </Text>
                {detail.goal != null && detail.goal > 0 && (
                  <Box mt={4} maxW="md">
                    <Progress
                      value={Math.min(100, (detail.pledged / detail.goal) * 100)}
                      colorScheme="brand"
                      rounded="full"
                      size="sm"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      ${detail.pledged.toLocaleString()} {t('project.ofGoal', { goal: detail.goal.toLocaleString() })}
                    </Text>
                  </Box>
                )}
              </Box>
              <Flex direction="column" gap={3} minW="220px" p={5} rounded="2xl" borderWidth="1px" bg="white" shadow="sm">
                {detail.status !== 'claimed' && (
                  <Button
                    as={Link}
                    href={`/claim/${detail.project}`}
                    colorScheme="brand"
                    rounded="xl"
                  >
                    {t('project.claim')}
                  </Button>
                )}
                <Text fontSize="xs" fontWeight="bold" color="gray.500">
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
                      value={amount}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                      rounded="lg"
                    />
                  </InputGroup>
                  <Button
                    size="sm"
                    colorScheme="brand"
                    variant="outline"
                    rounded="lg"
                    isLoading={pledging}
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
              {t('project.artifacts', { count: detail.artifacts.length })}
            </Heading>
            {assets === undefined ? (
              <SkeletonGrid items={4} compact columns={{ base: 2, md: 4, lg: 6 }}>
                <SkeletonTokenCard />
              </SkeletonGrid>
            ) : assets.length === 0 ? (
              <Text color="gray.500">{t('project.noArtifacts')}</Text>
            ) : (
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing={3}>
                {assets.map((asset, i) => (
                  <Flex key={i} justify="center" overflow="hidden">
                    <TokenCard asset={asset} />
                  </Flex>
                ))}
              </SimpleGrid>
            )}
          </>
        )}
      </Box>
    </LargeLayout>
  )
}

export default ProjectDetailPage
