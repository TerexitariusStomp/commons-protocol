import {
  Badge,
  Box,
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
const ARTIFACT_COLLECTION = '0x20cddf283164ee59742c80aa5ce9b97127f123ce'

type Claim = {
  project: string
  name: string | null
  description: string | null
  shortfall: string | null
  status: string
  royalty_bps: number | null
  artifactCount?: number
}

const ProjectsPage: NextPage = () => {
  const { t } = useTranslation('templates')
  useBreakpointValue({ base: true, md: false }, { fallback: 'md' })
  const search = useQueryParamSingle('search')
  const [projects, setProjects] = useState<Claim[] | undefined>()

  useEffect(() => {
    if (!INDEXER) return
    Promise.all([
      fetch(`${INDEXER}/claims`).then((r) => r.json()),
      fetch(`${INDEXER}/artifacts`).then((r) => r.json()),
    ])
      .then(([claims, artifacts]) => {
        const countByProject = new Map<string, number>()
        for (const a of artifacts as { project?: string }[]) {
          if (!a.project) continue
          countByProject.set(a.project, (countByProject.get(a.project) ?? 0) + 1)
        }
        setProjects(
          (claims as Claim[])
            .filter((c) => countByProject.has(c.project))
            .map((c) => ({ ...c, artifactCount: countByProject.get(c.project) }))
            .sort(
              (a, b) =>
                parseFloat(b.shortfall ?? '0') - parseFloat(a.shortfall ?? '0'),
            ),
        )
      })
      .catch(() => setProjects([]))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return projects
    const s = search.toLowerCase()
    return projects?.filter(
      (p) =>
        (p.name ?? p.project).toLowerCase().includes(s) ||
        p.project.toLowerCase().includes(s),
    )
  }, [projects, search])

  return (
    <>
      <Head title={t('explore.title')} />
      <ExploreTemplate
        title={t('explore.title')}
        search={search}
        selectedTabIndex={3}
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
              title={t('explore.projects.empty.title')}
              description={t('explore.projects.empty.description')}
            />
          ) : (
            <SimpleGrid
              columns={{ sm: 2, md: 3, lg: 4 }}
              spacing={4}
              py={6}
              alignItems="stretch"
            >
              {filtered.map((p) => (
                <Link
                  key={p.project}
                  href={`/explore?collection=1-${ARTIFACT_COLLECTION}&traits[Project]=${encodeURIComponent(
                    p.name ?? p.project,
                  )}`}
                >
                  <Box
                    borderWidth="1px"
                    borderRadius="xl"
                    p={4}
                    h="100%"
                    _hover={{ borderColor: 'brand.500' }}
                  >
                    <Flex justify="space-between" align="flex-start" gap={2}>
                      <Heading as="h3" variant="heading2" noOfLines={2}>
                        {p.name ?? p.project}
                      </Heading>
                      {p.status === 'claimed' && (
                        <Badge colorScheme="green">{t('explore.projects.claimed')}</Badge>
                      )}
                    </Flex>
                    {p.description && (
                      <Text fontSize="sm" color="gray.600" mt={1} noOfLines={3}>
                        {p.description}
                      </Text>
                    )}
                    <Text variant="subtitle2" color="gray.500" mt={2}>
                      {t('explore.projects.artifacts', {
                        count: p.artifactCount ?? 0,
                      })}
                    </Text>
                    <Text variant="subtitle2" color="brand.500" mt={1}>
                      {t('explore.projects.share', {
                        pct: ((p.royalty_bps ?? 1000) / 100).toString(),
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

export default ProjectsPage
