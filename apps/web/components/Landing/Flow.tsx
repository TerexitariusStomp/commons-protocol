import { Box, Flex, Heading, Icon, SimpleGrid, Text } from '@chakra-ui/react'
import { FaArrowRight } from '@react-icons/all-files/fa/FaArrowRight'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'

const Flow: FC = () => {
  const { t } = useTranslation('templates')
  const steps = [1, 2, 3, 4].map((i) => ({
    title: t(`landing.flow.s${i}title`),
    desc: t(`landing.flow.s${i}desc`),
  }))
  return (
    <Box py={16} maxW="7xl" mx="auto" px={4}>
      <Box textAlign="center" maxW="3xl" mx="auto" mb={12}>
        <Heading variant="heading1" fontSize={{ base: '2xl', md: '4xl' }}>
          {t('landing.flow.title')}
        </Heading>
        <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
          {t('landing.flow.desc')}
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={6}>
        {steps.map((s, i) => (
          <Flex key={i} align="flex-start" gap={3}>
            <Box flex={1} p={5} rounded="2xl" bg="white" shadow="sm" borderWidth="1px">
              <Flex w={8} h={8} rounded="full" bg="brand.500" color="white" align="center" justify="center" fontWeight="bold" fontSize="sm">
                {i + 1}
              </Flex>
              <Text fontWeight="bold" mt={3} fontSize="sm">
                {s.title}
              </Text>
              <Text color="gray.600" fontSize="xs" mt={1} lineHeight="relaxed">
                {s.desc}
              </Text>
            </Box>
            {i < 3 && (
              <Icon
                as={FaArrowRight}
                color="brand.300"
                mt={8}
                display={{ base: 'none', lg: 'block' }}
              />
            )}
          </Flex>
        ))}
      </SimpleGrid>
    </Box>
  )
}

export default Flow
