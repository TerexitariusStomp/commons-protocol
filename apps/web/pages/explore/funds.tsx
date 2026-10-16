import {
  Box,
  Button,
  Flex,
  Heading,
  SimpleGrid,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useMemo, useState } from 'react'
import Empty from '../../components/Empty/Empty'
import ExploreTemplate from '../../components/Explore'
import Head from '../../components/Head'
import Link from '../../components/Link/Link'
import SkeletonGrid from '../../components/Skeleton/Grid'
import SkeletonUserCard from '../../components/Skeleton/UserCard'
import useQueryParamSingle from '../../hooks/useQueryParamSingle'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type Fund = {
  id: string
  name: string
  description: string | null
  mechanism: string | null
  projects: string | null
  status: string | null
}

const FundsExplorePage: NextPage = () => {
  const { t } = useTranslation('templates')
  useBreakpointValue({ base: true, md: false }, { fallback: 'md' })
  const search = useQueryParamSingle('search')
  const [funds, setFunds] = useState<Fund[] | undefined>()
  const [tab, setTab] = useState<'active' | 'proposed'>('active')

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/funds`)
      .then((r) => r.json())
      .then((rows: Fund[]) =>
        setFunds(
          rows.filter((f) => {
            try {
              return (
                f.status === 'proposed' ||
                (JSON.parse(f.projects ?? '[]') as string[]).length > 0
              )
            } catch {
              return false
            }
          }),
        ),
      )
      .catch(() => setFunds([]))
  }, [])

  const filtered = useMemo(() => {
    const list = funds?.filter((f) =>
      tab === 'proposed'
        ? f.status === 'proposed'
        : f.status !== 'proposed',
    )
    if (!search) return list
    const s = search.toLowerCase()
    return list?.filter((f) => f.name?.toLowerCase().includes(s))
  }, [funds, search, tab])

  return (
    <>
      <Head title={t('explore.title')} />
      <ExploreTemplate
        title={t('explore.title')}
        search={search}
        selectedTabIndex={4}
      >
        <>
          <Flex gap={2} mt={4} align="center" flexWrap="wrap">
            {(['active', 'proposed'] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                rounded="full"
                variant={tab === k ? 'solid' : 'outline'}
                colorScheme="brand"
                onClick={() => setTab(k)}
              >
                {t(`explore.funds.tabs.${k}`)}
                {k === 'proposed' &&
                  ` (${funds?.filter((f) => f.status === 'proposed').length ?? 0})`}
              </Button>
            ))}
            <Box flex={1} />
            <Button as={Link} href="/propose" size="sm" colorScheme="brand" rounded="xl">
              {t('explore.funds.propose')}
            </Button>
          </Flex>
          {filtered === undefined ? (
            <SkeletonGrid
              items={12}
              compact
              columns={{ sm: 2, md: 3, lg: 4 }}
              py={6}
            >
              <SkeletonUserCard />
            </SkeletonGrid>
          ) : filtered.length === 0 ? (
            <Empty
              title={t('explore.funds.empty.title')}
              description={t('explore.funds.empty.description')}
            />
          ) : (
            <SimpleGrid
              columns={{ sm: 2, md: 3, lg: 4 }}
              spacing={4}
              py={6}
              alignItems="stretch"
            >
              {filtered.map((f) => (
                <Link key={f.id} href={`/funds/${f.id}`}>
                  <Box
                    borderWidth="1px"
                    borderRadius="xl"
                    p={4}
                    h="100%"
                    _hover={{ borderColor: 'brand.500' }}
                  >
                    <Heading as="h3" variant="heading2" noOfLines={2}>
                      {f.name}
                    </Heading>
                    {f.description && (
                      <Text fontSize="sm" color="gray.600" mt={1} noOfLines={3}>
                        {f.description}
                      </Text>
                    )}
                    <Text variant="subtitle2" color="gray.500" mt={2}>
                      {t('explore.funds.projects', {
                        count: (() => {
                          try {
                            return (JSON.parse(f.projects ?? '[]') as string[])
                              .length
                          } catch {
                            return 0
                          }
                        })(),
                      })}
                    </Text>
                  </Box>
                </Link>
              ))}
            </SimpleGrid>
          )}
        </>
      </ExploreTemplate>
    </>
  )
}

export default FundsExplorePage
