import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  SimpleGrid,
  SkeletonText,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Head from '../components/Head'
import Link from '../components/Link/Link'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type PointsData = {
  balance: number
  season: number
  events: { delta: number; reason: string; ref: string | null; ts: number }[]
  gifts: { fund_id: string; amount: number }[]
}

type Season = { id: number; daysLeft: number; rules: Record<string, number> }

const PointsPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { address } = useAccount()
  const [data, setData] = useState<PointsData | undefined>()
  const [season, setSeason] = useState<Season | undefined>()

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/season`).then((r) => r.json()).then(setSeason).catch(() => {})
  }, [])

  useEffect(() => {
    if (!INDEXER || !address) {
      setData(undefined)
      return
    }
    fetch(`${INDEXER}/points/${address}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(undefined))
  }, [address])

  const rules = season?.rules ?? {}

  return (
    <LargeLayout>
      <Head title={t('points.title')} />
      <Box py={10} maxW="4xl" mx="auto">
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
          <Box>
            <Heading variant="title">{t('points.title')}</Heading>
            <Text color="gray.600" mt={2} fontSize="sm">
              {t('points.sub', { season: season?.id ?? '—', days: season?.daysLeft ?? '—' })}
            </Text>
          </Box>
          <Box
            px={6}
            py={4}
            rounded="2xl"
            bg="brand.500"
            color="white"
            textAlign="center"
            shadow="lg"
          >
            <Text fontSize="3xl" fontWeight="extrabold">
              {data ? data.balance.toLocaleString() : '—'}
            </Text>
            <Text fontSize="xs" opacity={0.8}>
              {t('points.balance')}
            </Text>
          </Box>
        </Flex>
        {!address && (
          <Text color="gray.500" mt={6} fontSize="sm">
            {t('points.connect')}
          </Text>
        )}
        <Button as={Link} href="/allocate" colorScheme="brand" rounded="xl" mt={6}>
          {t('points.allocate')}
        </Button>

        <Heading variant="heading2" mt={12} mb={4}>
          {t('points.how')}
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={3}>
          {[
            ['welcome', rules.welcome],
            ['perPledgedUsd', rules.perPledgedUsd],
            ['perEndowedUsd', rules.perEndowedUsd],
            ['createProject', rules.createProject],
            ['artizenAlumni', rules.artizenAlumni],
            ['proposeFund', rules.proposeFund],
          ].map(([k, v]) => (
            <Flex key={k} p={4} rounded="2xl" bg="white" borderWidth="1px" justify="space-between" align="center">
              <Text fontSize="sm">{t(`points.rules.${k}`)}</Text>
              <Badge colorScheme="brand" fontSize="sm">
                {v != null ? `+${v}` : '—'}
              </Badge>
            </Flex>
          ))}
        </SimpleGrid>

        <Heading variant="heading2" mt={12} mb={4}>
          {t('points.history')}
        </Heading>
        {data === undefined ? (
          <SkeletonText noOfLines={4} spacing={3} />
        ) : data.events.length === 0 ? (
          <Text color="gray.500" fontSize="sm">
            {t('points.empty')}
          </Text>
        ) : (
          <Box rounded="2xl" borderWidth="1px" overflow="hidden" bg="white">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>{t('points.col.reason')}</Th>
                  <Th>{t('points.col.ref')}</Th>
                  <Th isNumeric>{t('points.col.points')}</Th>
                  <Th>{t('points.col.date')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.events.map((e, i) => (
                  <Tr key={i}>
                    <Td fontWeight="medium">{e.reason}</Td>
                    <Td color="gray.500" fontSize="xs">
                      {e.ref ?? '—'}
                    </Td>
                    <Td isNumeric fontWeight="bold" color={e.delta >= 0 ? 'green.500' : 'red.500'}>
                      {e.delta >= 0 ? '+' : ''}
                      {e.delta}
                    </Td>
                    <Td color="gray.500" fontSize="xs">
                      {new Date(e.ts * 1000).toLocaleDateString()}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
        <Divider mt={12} />
      </Box>
    </LargeLayout>
  )
}

export default PointsPage
