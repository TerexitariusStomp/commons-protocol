import {
  Badge,
  Box,
  Flex,
  Heading,
  Icon,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import { FaCoins } from '@react-icons/all-files/fa/FaCoins'
import { FaPiggyBank } from '@react-icons/all-files/fa/FaPiggyBank'
import { FaStore } from '@react-icons/all-files/fa/FaStore'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'

const Pillars: FC = () => {
  const { t } = useTranslation('templates')
  const pillars = [
    { icon: FaStore, tag: t('landing.pillars.1.tag'), title: t('landing.pillars.1.title'), desc: t('landing.pillars.1.desc'), color: 'brand.500' },
    { icon: FaPiggyBank, tag: t('landing.pillars.2.tag'), title: t('landing.pillars.2.title'), desc: t('landing.pillars.2.desc'), color: 'cyan.500' },
    { icon: FaCoins, tag: t('landing.pillars.3.tag'), title: t('landing.pillars.3.title'), desc: t('landing.pillars.3.desc'), color: 'purple.500' },
  ]
  return (
    <Box py={16} borderTopWidth="1px"
      borderBottomWidth="1px" bg="white">
      <Box textAlign="center" maxW="3xl" mx="auto" mb={12} px={4}>
        <Badge colorScheme="brand" variant="subtle" rounded="full" px={3} py={1} fontSize="xs">
          {t('landing.pillars.pill')}
        </Badge>
        <Heading variant="heading1" mt={3} fontSize={{ base: '2xl', md: '4xl' }}>
          {t('landing.pillars.title')}
        </Heading>
        <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
          {t('landing.pillars.desc')}
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} maxW="7xl" mx="auto" px={4}>
        {pillars.map((p, i) => (
          <Box
            key={i}
            p={{ base: 6, md: 8 }}
            rounded="3xl"
            bg="white"
            shadow="sm"
            borderTop="4px solid"
            borderColor={p.color}
          >
            <Flex
              w={12}
              h={12}
              rounded="xl"
              bg="gray.50"
              color={p.color}
              align="center"
              justify="center"
              borderWidth="1px"
            >
              <Icon as={p.icon} boxSize={5} />
            </Flex>
            <Text mt={4} fontSize="2xs" fontWeight="bold" color={p.color} textTransform="uppercase" letterSpacing="wider">
              {p.tag}
            </Text>
            <Heading variant="heading2" mt={1}>
              {p.title}
            </Heading>
            <Text color="gray.600" fontSize="sm" mt={2} lineHeight="relaxed">
              {p.desc}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  )
}

export default Pillars
