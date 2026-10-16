import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Text,
} from '@chakra-ui/react'
import useTranslation from 'next-translate/useTranslation'
import { FC, useEffect, useState } from 'react'
import { useFetchAllErc721And1155Query } from '../../src/graphql'
import Image from '../Image/Image'
import Link from '../Link/Link'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

const Hero: FC = () => {
  const { t } = useTranslation('templates')
  const [stats, setStats] = useState({ artifacts: 180, projects: 176, funds: 258 })
  const { data } = useFetchAllErc721And1155Query({
    variables: {
      address: '',
      limit: 12,
      offset: 0,
      orderBy: null,
      condition: null,
    },
  })
  const images = (data?.assets?.nodes ?? [])
    .map((a) => a.image)
    .filter(Boolean) as string[]

  useEffect(() => {
    if (!INDEXER) return
    Promise.all([
      fetch(`${INDEXER}/artifacts`).then((r) => r.json()),
      fetch(`${INDEXER}/claims`).then((r) => r.json()),
      fetch(`${INDEXER}/funds`).then((r) => r.json()),
    ])
      .then(([artifacts, claims, funds]) => {
        setStats({
          artifacts: Array.isArray(artifacts) ? artifacts.length : 180,
          projects: Array.isArray(claims)
            ? claims.filter((c: any) => c.description).length
            : 176,
          funds: Array.isArray(funds) ? funds.length : 258,
        })
      })
      .catch(() => {})
  }, [])

  return (
    <Box position="relative" overflow="hidden" py={{ base: 10, md: 16 }}>
      <Box
        position="absolute"
        top="10"
        left="25%"
        w="96"
        h="96"
        bg="brand.50"
        rounded="full"
        filter="blur(80px)"
        opacity={0.6}
        pointerEvents="none"
      />
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        gap={{ base: 8, lg: 12 }}
        align="center"
        position="relative"
      >
        <Box flex={{ lg: 7 }} textAlign={{ base: 'center', lg: 'left' }}>
          <Badge
            colorScheme="brand"
            variant="subtle"
            rounded="full"
            px={3}
            py={1}
            fontSize="xs"
          >
            {t('landing.hero.pill')}
          </Badge>
          <Heading
            as="h1"
            variant="title"
            mt={4}
            fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
            lineHeight="tight"
          >
            {t('landing.hero.title1')}{' '}
            <Text
              as="span"
              bgGradient="linear(to-r, brand.500, cyan.500)"
              bgClip="text"
            >
              {t('landing.hero.title2')}
            </Text>
          </Heading>
          <Text
            color="gray.600"
            mt={4}
            maxW="2xl"
            mx={{ base: 'auto', lg: 0 }}
            fontSize={{ base: 'sm', md: 'md' }}
          >
            {t('landing.hero.desc')}
          </Text>
          <Flex
            gap={3}
            mt={6}
            direction={{ base: 'column', sm: 'row' }}
            justify={{ base: 'center', lg: 'flex-start' }}
          >
            <Button
              as={Link}
              href="/explore"
              colorScheme="brand"
              size="lg"
              rounded="xl"
            >
              {t('landing.hero.ctaMain')}
            </Button>
            <Button
              as={Link}
              href="/how"
              variant="outline"
              colorScheme="brand"
              size="lg"
              rounded="xl"
            >
              {t('landing.hero.ctaSec')}
            </Button>
          </Flex>
          <Grid
            templateColumns="repeat(3, 1fr)"
            gap={3}
            mt={8}
            pt={6}
            borderTopWidth="1px"
          >
            {[
              [stats.artifacts, t('landing.hero.stat1')],
              [stats.projects, t('landing.hero.stat2')],
              [stats.funds, t('landing.hero.stat3')],
            ].map(([v, label], i) => (
              <Box key={i}>
                <Text fontWeight="bold" fontSize={{ base: 'sm', md: 'lg' }}>
                  {v}
                </Text>
                <Text fontSize={{ base: '2xs', md: 'xs' }} color="gray.500">
                  {label}
                </Text>
              </Box>
            ))}
          </Grid>
        </Box>
        <Box flex={{ lg: 5 }} w="full" maxW="lg">
          <Grid
            templateColumns="repeat(4, 1fr)"
            gap={2}
            rounded="3xl"
            overflow="hidden"
            shadow="xl"
            border="2px solid"
            borderColor="brand.100"
          >
            {images.slice(0, 12).map((src, i) => (
              <AspectRatio key={i} ratio={1}>
                <Image src={src} alt="" fill sizes="120px" objectFit="cover" />
              </AspectRatio>
            ))}
            {images.length === 0 &&
              Array.from({ length: 12 }).map((_, i) => (
                <AspectRatio key={i} ratio={1}>
                  <Box bg="brand.50" />
                </AspectRatio>
              ))}
          </Grid>
        </Box>
      </Flex>
    </Box>
  )
}

export default Hero
