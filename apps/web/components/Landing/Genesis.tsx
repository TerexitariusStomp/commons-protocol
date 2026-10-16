import {
  AspectRatio,
  Badge,
  Box,
  Flex,
  Grid,
  Heading,
  Icon,
  ListItem,
  SimpleGrid,
  Text,
  UnorderedList,
} from '@chakra-ui/react'
import { FaCheckCircle } from '@react-icons/all-files/fa/FaCheckCircle'
import { FaCoins } from '@react-icons/all-files/fa/FaCoins'
import { FaImages } from '@react-icons/all-files/fa/FaImages'
import { FaVoteYea } from '@react-icons/all-files/fa/FaVoteYea'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'
import { useFetchAllErc721And1155Query } from '../../src/graphql'
import Image from '../Image/Image'

const Genesis: FC = () => {
  const { t } = useTranslation('templates')
  const { data } = useFetchAllErc721And1155Query({
    variables: {
      address: '',
      limit: 8,
      offset: 24,
      orderBy: null,
      condition: null,
    },
  })
  const images = (data?.assets?.nodes ?? [])
    .map((a) => a.image)
    .filter(Boolean) as string[]

  const cards = [
    { icon: FaCoins, title: t('landing.genesis.c1title'), desc: t('landing.genesis.c1desc'), foot: t('landing.genesis.c1foot') },
    { icon: FaImages, title: t('landing.genesis.c2title'), desc: t('landing.genesis.c2desc'), foot: t('landing.genesis.c2foot') },
    { icon: FaVoteYea, title: t('landing.genesis.c3title'), desc: t('landing.genesis.c3desc'), foot: t('landing.genesis.c3foot') },
  ]

  return (
    <Box py={16} bgGradient="linear(to-b, gray.50, brand.50 40%, gray.50)" position="relative" overflow="hidden">
      <Box maxW="7xl" mx="auto" px={4} position="relative">
        <Box textAlign="center" maxW="3xl" mx="auto" mb={12}>
          <Badge colorScheme="brand" rounded="full" px={3} py={1} fontSize="xs">
            {t('landing.genesis.pill')}
          </Badge>
          <Heading variant="heading1" mt={3} fontSize={{ base: '2xl', md: '4xl' }}>
            {t('landing.genesis.title')}
          </Heading>
          <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
            {t('landing.genesis.desc')}
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={8} alignItems="center" mb={12}>
          <Grid
            templateColumns="repeat(4, 1fr)"
            gap={2}
            rounded="3xl"
            overflow="hidden"
            shadow="xl"
            border="2px solid"
            borderColor="brand.100"
          >
            {images.map((src, i) => (
              <AspectRatio key={i} ratio={1}>
                <Image src={src} alt="" fill sizes="120px" objectFit="cover" />
              </AspectRatio>
            ))}
          </Grid>
          <Box>
            <Badge colorScheme="brand" variant="subtle" rounded="full" px={3} py={1} fontSize="xs">
              {t('landing.genesis.featTag')}
            </Badge>
            <Heading variant="heading2" mt={3} fontSize={{ base: 'xl', md: '2xl' }}>
              {t('landing.genesis.featTitle')}
            </Heading>
            <Text color="gray.600" fontSize="sm" mt={3} lineHeight="relaxed">
              {t('landing.genesis.featDesc')}
            </Text>
            <UnorderedList mt={4} spacing={2} styleType="none" ml={0}>
              {[1, 2, 3].map((i) => (
                <ListItem key={i} display="flex" alignItems="center" gap={2} fontSize="sm" fontWeight="medium" color="gray.700">
                  <Icon as={FaCheckCircle} color="green.500" />
                  {t(`landing.genesis.li${i}`)}
                </ListItem>
              ))}
            </UnorderedList>
          </Box>
        </Grid>
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={6}>
          {cards.map((c, i) => (
            <Flex key={i} direction="column" justify="space-between" p={{ base: 6, md: 8 }} rounded="3xl" bg="white" shadow="sm" borderTop="4px solid" borderColor="brand.400">
              <Box>
                <Flex w={12} h={12} rounded="xl" bg="brand.50" color="brand.600" align="center" justify="center" borderWidth="1px" borderColor="brand.100">
                  <Icon as={c.icon} boxSize={5} />
                </Flex>
                <Heading variant="heading2" mt={4} fontSize={{ base: 'lg', md: 'xl' }}>
                  {c.title}
                </Heading>
                <Text color="gray.600" fontSize="sm" mt={2} lineHeight="relaxed">
                  {c.desc}
                </Text>
              </Box>
              <Flex pt={4} mt={4} borderTopWidth="1px" fontSize="xs" fontWeight="semibold" color="brand.700" align="center" gap={2}>
                <Icon as={FaCheckCircle} color="green.500" />
                {c.foot}
              </Flex>
            </Flex>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  )
}

export default Genesis
