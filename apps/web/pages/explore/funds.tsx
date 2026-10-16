import {
  Box,
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
const ARTIFACT_COLLECTION = '0x20cddf283164ee59742c80aa5ce9b97127f123ce'

type Fund = {
  id: string
  name: string
  mechanism: string | null
  projects: string | null
}

const FundsExplorePage: NextPage = () => {
  const { t } = useTranslation('templates')
  useBreakpointValue({ base: true, md: false }, { fallback: 'md' })
  const search = useQueryParamSingle('search')
  const [funds, setFunds] = useState<Fund[] | undefined>()

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/funds`)
      .then((r) => r.json())
      .then((rows: Fund[]) =>
        setFunds(
          rows.filter((f) => {
            try {
              return (JSON.parse(f.projects ?? '[]') as string[]).length > 0
            } catch {
              return false
            }
          }),
        ),
      )
      .catch(() => setFunds([]))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return funds
    const s = search.toLowerCase()
    return funds?.filter((f) => f.name?.toLowerCase().includes(s))
  }, [funds, search])

  return (
    <>
      <Head title={t('explore.title')} />
      <ExploreTemplate
        title={t('explore.title')}
        search={search}
        selectedTabIndex={4}
      >
        <>
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
                <Link
                  key={f.id}
                  href={`/explore?collection=1-${ARTIFACT_COLLECTION}&traits[Fund]=${encodeURIComponent(
                    f.name,
                  )}`}
                >
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
