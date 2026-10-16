import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import { FaPlus } from '@react-icons/all-files/fa/FaPlus'
import { FaTimes } from '@react-icons/all-files/fa/FaTimes'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useMemo, useState } from 'react'
import Head from '../components/Head'
import Link from '../components/Link/Link'
import LargeLayout from '../layouts/large'
import {
  MECHANISM_INFO,
  computeMatches,
  type Contribution,
  type Mechanism,
} from '../src/lib/matching'

const MatchSandbox = () => {
  const { t } = useTranslation('templates')
  const [mech, setMech] = useState<'qf' | 'match' | 'multiplier'>('qf')
  const [param, setParam] = useState(100)
  const [pool, setPool] = useState(1000)
  const [donors, setDonors] = useState<Contribution[]>([
    { projectId: 'A', donor: 'd1', amount: 5 },
    { projectId: 'A', donor: 'd2', amount: 5 },
    { projectId: 'B', donor: 'd3', amount: 50 },
  ])

  const mechanism: Mechanism = useMemo(
    () =>
      mech === 'qf'
        ? { type: 'qf' }
        : mech === 'match'
          ? { type: 'match', cap: param }
          : { type: 'multiplier', x: Math.max(1, param) },
    [mech, param],
  )
  const projectIds = useMemo(
    () => [...new Set(donors.map((d) => d.projectId))].sort(),
    [donors],
  )
  const result = useMemo(
    () => computeMatches(mechanism, pool, projectIds, donors),
    [mechanism, pool, projectIds, donors],
  )
  const usd = (n: number) => `$${n.toFixed(2)}`

  return (
    <Box p={{ base: 5, md: 8 }} rounded="3xl" bg="white" shadow="sm" borderWidth="1px">
      <Flex gap={3} flexWrap="wrap" mb={4}>
        <Select
          w="auto"
          size="sm"
          rounded="xl"
          value={mech}
          onChange={(e) => setMech(e.target.value as typeof mech)}
          fontWeight="semibold"
        >
          <option value="qf">{MECHANISM_INFO.qf.name}</option>
          <option value="match">{MECHANISM_INFO.match.name}</option>
          <option value="multiplier">{MECHANISM_INFO.multiplier.name}</option>
        </Select>
        {mech !== 'qf' && (
          <Input
            w={24}
            size="sm"
            rounded="xl"
            type="number"
            value={param}
            onChange={(e) => setParam(Math.max(0, Number(e.target.value) || 0))}
            placeholder={mech === 'match' ? 'cap $' : '× multiplier'}
          />
        )}
        <Flex align="center" gap={2}>
          <Text fontSize="xs" fontWeight="bold" whiteSpace="nowrap">
            {t('how.sandbox.pool')}
          </Text>
          <Input
            w={28}
            size="sm"
            rounded="xl"
            type="number"
            min={0}
            value={pool}
            onChange={(e) => setPool(Math.max(0, Number(e.target.value) || 0))}
          />
        </Flex>
      </Flex>
      <Divider mb={4} />
      <Flex gap={6} direction={{ base: 'column', md: 'row' }}>
        <Box flex={1}>
          <Flex justify="space-between" mb={2}>
            <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
              {t('how.sandbox.contributions')}
            </Text>
            <IconButton
              aria-label="add"
              size="xs"
              icon={<FaPlus />}
              variant="ghost"
              onClick={() =>
                setDonors((d) => [
                  ...d,
                  { projectId: 'A', donor: `d${d.length + 1}`, amount: 10 },
                ])
              }
            />
          </Flex>
          {donors.map((d, i) => (
            <Flex key={i} gap={2} mb={2} align="center">
              <Select
                w={20}
                size="sm"
                rounded="lg"
                value={d.projectId}
                onChange={(e) =>
                  setDonors((x) =>
                    x.map((c, j) => (j === i ? { ...c, projectId: e.target.value } : c)),
                  )
                }
              >
                {['A', 'B', 'C'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Input
                w={24}
                size="sm"
                rounded="lg"
                type="number"
                min={0}
                value={d.amount}
                onChange={(e) =>
                  setDonors((x) =>
                    x.map((c, j) =>
                      j === i ? { ...c, amount: Math.max(0, Number(e.target.value) || 0) } : c,
                    ),
                  )
                }
              />
              <IconButton
                aria-label="remove"
                size="xs"
                variant="ghost"
                icon={<FaTimes />}
                onClick={() => setDonors((x) => x.filter((_, j) => j !== i))}
              />
            </Flex>
          ))}
        </Box>
        <Box flex={1}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={2}>
            {t('how.sandbox.allocation')}
          </Text>
          {projectIds.map((p) => (
            <Flex key={p} justify="space-between" py={1.5} fontSize="sm" borderBottomWidth="1px">
              <Text fontWeight="semibold">Project {p}</Text>
              <Text fontFamily="mono" color="brand.600" fontWeight="bold">
                {usd(result.matches[p] ?? 0)}
              </Text>
            </Flex>
          ))}
          <Flex justify="space-between" pt={3} fontSize="xs" color="gray.500">
            <Text>{t('how.sandbox.coverage')}</Text>
            <Text fontWeight="bold">{(result.coverage * 100).toFixed(0)}%</Text>
          </Flex>
        </Box>
      </Flex>
    </Box>
  )
}

const HowPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const faqs = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    q: t(`how.faq.q${i}`),
    a: t(`how.faq.a${i}`),
  }))
  return (
    <LargeLayout>
      <Head title={t('how.title')} />
      <Box maxW="4xl" mx="auto" py={12} px={4}>
        <Box textAlign="center" mb={12}>
          <Heading variant="title" fontSize={{ base: '3xl', md: '5xl' }}>
            {t('how.title')}
          </Heading>
          <Text color="gray.600" mt={3} maxW="2xl" mx="auto" fontSize={{ base: 'sm', md: 'lg' }}>
            {t('how.sub')}
          </Text>
        </Box>

        <Heading variant="heading2" mb={4}>
          {t('how.mechanisms')}
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={12}>
          {(['qf', 'match', 'multiplier'] as const).map((k) => (
            <Box key={k} p={5} rounded="2xl" bg="white" borderWidth="1px" shadow="sm">
              <Badge colorScheme="brand" mb={2}>
                {MECHANISM_INFO[k].short}
              </Badge>
              <Text fontWeight="semibold">{t(`how.mech.${k}.name`)}</Text>
              <Text mt={2} fontSize="sm" color="gray.600">
                {t(`how.mech.${k}.explain`)}
              </Text>
            </Box>
          ))}
        </SimpleGrid>

        <Heading variant="heading2" mb={4}>
          {t('how.sandbox.title')}
        </Heading>
        <MatchSandbox />

        <Heading variant="heading2" mt={12} mb={4}>
          {t('how.questions')}
        </Heading>
        <Accordion allowMultiple>
          {faqs.map((f, i) => (
            <AccordionItem key={i} bg="white" rounded="2xl" borderWidth="1px" mb={3} overflow="hidden">
              <AccordionButton px={6} py={4}>
                <Box flex="1" textAlign="left" fontWeight="semibold" fontSize="sm">
                  {f.q}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel px={6} pb={5} fontSize="sm" color="gray.600" lineHeight="relaxed">
                {f.a}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        <Flex justify="center" gap={3} mt={12}>
          <Button as={Link} href="/explore/funds" colorScheme="brand" size="lg" rounded="xl">
            {t('how.ctaFunds')}
          </Button>
          <Button as={Link} href="/claim" variant="outline" colorScheme="brand" size="lg" rounded="xl">
            {t('how.ctaClaim')}
          </Button>
        </Flex>
      </Box>
    </LargeLayout>
  )
}

export default HowPage
