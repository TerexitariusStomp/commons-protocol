import {
  Badge,
  Box,
  Divider,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
} from '@chakra-ui/react'
import useTranslation from 'next-translate/useTranslation'
import { FC, useEffect, useMemo, useState } from 'react'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''
const PROTOCOL_FEE_BPS = 50 // 0.5% → Pot

type Claim = {
  project: string
  name: string | null
  royalty_bps: number | null
}

const Simulator: FC = () => {
  const { t } = useTranslation('templates')
  const [projects, setProjects] = useState<Claim[]>([])
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState(100)
  const [sales, setSales] = useState(10)

  useEffect(() => {
    if (!INDEXER) return
    Promise.all([
      fetch(`${INDEXER}/claims`).then((r) => r.json()),
      fetch(`${INDEXER}/artifacts`).then((r) => r.json()),
    ])
      .then(([claims, artifacts]) => {
        const linked = new Set(
          (artifacts as { project?: string }[]).map((a) => a.project).filter(Boolean),
        )
        const list = (claims as Claim[])
          .filter((c) => linked.has(c.project))
          .sort((a, b) => (a.name ?? a.project).localeCompare(b.name ?? b.project))
        setProjects(list)
        if (list[0]) setSlug(list[0].project)
      })
      .catch(() => {})
  }, [])

  const calc = useMemo(() => {
    const claim = projects.find((p) => p.project === slug)
    const royaltyBps = claim?.royalty_bps ?? 1000 // default 10% pre-claim
    const royalty = (price * royaltyBps) / 10000
    const fee = (price * PROTOCOL_FEE_BPS) / 10000
    const seller = price - royalty - fee
    return {
      claim,
      royaltyBps,
      royalty,
      fee,
      seller,
      monthlyProject: royalty * sales,
      monthlyPot: fee * sales,
    }
  }, [projects, slug, price, sales])

  const usd = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

  return (
    <Box py={16} maxW="7xl" mx="auto" px={4}>
      <Box textAlign="center" maxW="3xl" mx="auto" mb={12}>
        <Badge colorScheme="brand" variant="subtle" rounded="full" px={3} py={1} fontSize="xs">
          {t('landing.sim.pill')}
        </Badge>
        <Heading variant="heading1" mt={3} fontSize={{ base: '2xl', md: '4xl' }}>
          {t('landing.sim.title')}
        </Heading>
        <Text color="gray.600" mt={3} fontSize={{ base: 'sm', md: 'md' }}>
          {t('landing.sim.desc')}
        </Text>
      </Box>
      <Flex
        direction={{ base: 'column', md: 'row' }}
        gap={6}
        maxW="4xl"
        mx="auto"
        p={{ base: 6, md: 10 }}
        rounded="3xl"
        bg="white"
        shadow="lg"
        borderWidth="1px"
        align="stretch"
      >
        <Box flex={1}>
          <Text fontSize="xs" fontWeight="bold" mb={1.5}>
            {t('landing.sim.project')}
          </Text>
          <Select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            rounded="xl"
            size="sm"
            fontWeight="semibold"
          >
            {projects.map((p) => (
              <option key={p.project} value={p.project}>
                {p.name ?? p.project}
              </option>
            ))}
          </Select>
          <Text fontSize="xs" fontWeight="bold" mt={4} mb={1.5}>
            {t('landing.sim.price')}
          </Text>
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none" color="gray.500">
              $
            </InputLeftElement>
            <Input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
              rounded="xl"
              fontWeight="bold"
            />
          </InputGroup>
          <Text fontSize="xs" fontWeight="bold" mt={4} mb={1.5}>
            {t('landing.sim.sales', { count: sales })}
          </Text>
          <Slider min={1} max={100} value={sales} onChange={setSales} colorScheme="brand">
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          {calc.claim && (
            <Text fontSize="2xs" color="gray.500" mt={4} p={3} bg="gray.50" rounded="xl" borderWidth="1px">
              {t('landing.sim.note', { pct: (calc.royaltyBps / 100).toString() })}
            </Text>
          )}
        </Box>
        <Box flex={1} bg="gray.900" color="white" p={{ base: 6, md: 8 }} rounded="2xl" shadow="xl">
          <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider" color="gray.400" fontWeight="semibold">
            {t('landing.sim.resultTitle')}
          </Text>
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color="brand.200">
            {usd(calc.monthlyProject)}
          </Text>
          <Text fontSize="2xs" color="gray.300">
            {t('landing.sim.toProject', { project: calc.claim?.name ?? '' })}
          </Text>
          <Divider borderColor="gray.700" my={4} />
          {[
            [t('landing.sim.royaltyPerSale', { pct: (calc.royaltyBps / 100).toString() }), usd(calc.royalty)],
            [t('landing.sim.potPerSale'), usd(calc.fee)],
            [t('landing.sim.sellerGets'), usd(calc.seller)],
            [t('landing.sim.potMonthly'), usd(calc.monthlyPot)],
          ].map(([label, value], i) => (
            <Flex key={i} justify="space-between" fontSize="xs" py={1}>
              <Text color="gray.400">{label}</Text>
              <Text fontFamily="mono" color="green.300">
                {value}
              </Text>
            </Flex>
          ))}
        </Box>
      </Flex>
    </Box>
  )
}

export default Simulator
