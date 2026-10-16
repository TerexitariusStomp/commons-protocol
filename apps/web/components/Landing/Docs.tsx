import {
  Badge,
  Box,
  Flex,
  Heading,
  Icon,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import { FaBookOpen } from '@react-icons/all-files/fa/FaBookOpen'
import { FaFileContract } from '@react-icons/all-files/fa/FaFileContract'
import { FaFileInvoice } from '@react-icons/all-files/fa/FaFileInvoice'
import { FaListUl } from '@react-icons/all-files/fa/FaListUl'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'
import Link from '../Link/Link'

const REPO = 'https://github.com/TerexitariusStomp/commons-protocol/blob/master'

const Docs: FC = () => {
  const { t } = useTranslation('templates')
  const docs = [
    { icon: FaBookOpen, title: t('landing.docs.whitepaper'), desc: t('landing.docs.whitepaper-desc'), href: '/whitepaper' },
    { icon: FaBookOpen, title: 'README', desc: t('landing.docs.readme'), href: `${REPO}/README.md` },
    { icon: FaListUl, title: 'OSS Inventory', desc: t('landing.docs.oss'), href: `${REPO}/docs/OSS-INVENTORY.md` },
    { icon: FaFileInvoice, title: 'Licenses', desc: t('landing.docs.licenses'), href: `${REPO}/docs/LICENSES.md` },
    { icon: FaFileContract, title: 'Contracts', desc: t('landing.docs.contracts'), href: `${REPO}/contracts` },
  ]
  return (
    <Box py={16} bg="white" borderTopWidth="1px">
      <Box maxW="7xl" mx="auto" px={4}>
        <Box textAlign="center" maxW="3xl" mx="auto" mb={12}>
          <Badge colorScheme="brand" variant="subtle" rounded="full" px={3} py={1} fontSize="xs">
            {t('landing.docs.pill')}
          </Badge>
          <Heading variant="heading1" mt={3} fontSize={{ base: '2xl', md: '4xl' }}>
            {t('landing.docs.title')}
          </Heading>
        </Box>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4} maxW="5xl" mx="auto">
          {docs.map((d, i) => (
            <Link key={i} href={d.href} isExternal={d.href.startsWith('http')}>
              <Flex direction="column" p={6} rounded="2xl" borderWidth="1px" h="full" _hover={{ borderColor: 'brand.500', shadow: 'sm' }} transition="all 0.15s">
                <Icon as={d.icon} color="brand.500" boxSize={5} />
                <Text fontWeight="bold" fontSize="sm" mt={3}>
                  {d.title}
                </Text>
                <Text color="gray.600" fontSize="xs" mt={1}>
                  {d.desc}
                </Text>
              </Flex>
            </Link>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  )
}

export default Docs
