import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import { FaFolderOpen } from '@react-icons/all-files/fa/FaFolderOpen'
import { FaLayerGroup } from '@react-icons/all-files/fa/FaLayerGroup'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'
import Link from '../Link/Link'

const ProjectsFunds: FC = () => {
  const { t } = useTranslation('templates')
  const cards = [
    {
      icon: FaFolderOpen,
      tag: t('landing.pf.ptag'),
      title: t('landing.pf.ptitle'),
      desc: t('landing.pf.pdesc'),
      href: '/explore/projects',
      cta: t('landing.pf.pcta'),
    },
    {
      icon: FaLayerGroup,
      tag: t('landing.pf.ftag'),
      title: t('landing.pf.ftitle'),
      desc: t('landing.pf.fdesc'),
      href: '/explore/funds',
      cta: t('landing.pf.fcta'),
    },
  ]
  return (
    <Box py={16} bg="white" borderTopWidth="1px">
      <Box maxW="7xl" mx="auto" px={4}>
        <Box textAlign="center" maxW="3xl" mx="auto" mb={12}>
          <Badge colorScheme="brand" variant="subtle" rounded="full" px={3} py={1} fontSize="xs">
            {t('landing.pf.pill')}
          </Badge>
          <Heading variant="heading1" mt={3} fontSize={{ base: '2xl', md: '4xl' }}>
            {t('landing.pf.title')}
          </Heading>
          <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
            {t('landing.pf.desc')}
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} maxW="4xl" mx="auto">
          {cards.map((c, i) => (
            <Flex key={i} direction="column" p={{ base: 6, md: 8 }} rounded="3xl" borderWidth="1px" shadow="sm" _hover={{ shadow: 'md' }} transition="box-shadow 0.2s">
              <Flex w={12} h={12} rounded="xl" bg="brand.50" color="brand.600" align="center" justify="center" borderWidth="1px" borderColor="brand.100">
                <Icon as={c.icon} boxSize={5} />
              </Flex>
              <Text mt={4} fontSize="2xs" fontWeight="bold" color="brand.500" textTransform="uppercase" letterSpacing="wider">
                {c.tag}
              </Text>
              <Heading variant="heading2" mt={1}>
                {c.title}
              </Heading>
              <Text color="gray.600" fontSize="sm" mt={2} lineHeight="relaxed" flex={1}>
                {c.desc}
              </Text>
              <Button as={Link} href={c.href} colorScheme="brand" variant="outline" rounded="xl" mt={6} alignSelf="flex-start">
                {c.cta}
              </Button>
            </Flex>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  )
}

export default ProjectsFunds
