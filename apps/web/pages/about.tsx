import { Box, Button, Flex, Heading, Text } from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import Docs from '../components/Landing/Docs'
import Faq from '../components/Landing/Faq'
import Flow from '../components/Landing/Flow'
import Genesis from '../components/Landing/Genesis'
import Hero from '../components/Landing/Hero'
import Pillars from '../components/Landing/Pillars'
import ProjectsFunds from '../components/Landing/ProjectsFunds'
import Simulator from '../components/Landing/Simulator'
import Head from '../components/Head'
import Link from '../components/Link/Link'
import LargeLayout from '../layouts/large'

const AboutPage: NextPage = () => {
  const { t } = useTranslation('templates')
  return (
    <LargeLayout>
      <Head title={t('landing.title')} description={t('landing.hero.desc')} />
      <Hero />
      <Pillars />
      <Genesis />
      <Flow />
      <ProjectsFunds />
      <Simulator />
      <Docs />
      <Faq />
      <Box py={16} px={4}>
        <Flex
          direction="column"
          align="center"
          textAlign="center"
          maxW="3xl"
          mx="auto"
          p={{ base: 8, md: 12 }}
          rounded="3xl"
          bgGradient="linear(to-r, brand.600, cyan.600)"
          color="white"
        >
          <Heading fontSize={{ base: 'xl', md: '3xl' }}>
            {t('landing.cta.title')}
          </Heading>
          <Text mt={3} fontSize={{ base: 'sm', md: 'md' }} opacity={0.9}>
            {t('landing.cta.desc')}
          </Text>
          <Flex gap={3} mt={6} direction={{ base: 'column', sm: 'row' }}>
            <Button
              as={Link}
              href="/explore"
              bg="white"
              color="brand.700"
              _hover={{ bg: 'gray.100' }}
              rounded="xl"
              size="lg"
            >
              {t('landing.cta.explore')}
            </Button>
            <Button
              as={Link}
              href="/claim"
              variant="outline"
              borderColor="whiteAlpha.600"
              color="white"
              _hover={{ bg: 'whiteAlpha.200' }}
              rounded="xl"
              size="lg"
            >
              {t('landing.cta.claim')}
            </Button>
          </Flex>
        </Flex>
      </Box>
    </LargeLayout>
  )
}

export default AboutPage
