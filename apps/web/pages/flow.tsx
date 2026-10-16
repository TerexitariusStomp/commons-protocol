import {
  Box,
  Button,
  Card,
  CardBody,
  Code,
  Heading,
  SimpleGrid,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import {
  runFlowSimulation,
  SimHolon,
} from '../../../vendor/upstream/naoms-flow-funding/sim/driver'
import Head from '../components/Head'
import useEnvironment from '../hooks/useEnvironment'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type Policy = {
  node: string
  floor: number
  ceiling: number
  gradient: number
  per_claimant_cap: number
  per_epoch_cap: number
  enabled: number
}

type FlowEvent = {
  epoch: number
  from_node: string
  to_node: string
  amount: number
  status: string
}

const FlowPage: NextPage = () => {
  const env = useEnvironment()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [report, setReport] = useState('')
  const [scenario, setScenario] = useState(
    JSON.stringify(
      [
        {
          id: 'pot',
          balance: 50000,
          floor: 10000,
          ceiling: 40000,
          gradient: 0.5,
          channels: [
            { to: 'project-a', trustWeight: 1 },
            { to: 'project-b', trustWeight: 0.5 },
          ],
        },
        {
          id: 'project-a',
          balance: 2000,
          floor: 8000,
          ceiling: 20000,
          channels: [],
        },
        {
          id: 'project-b',
          balance: 1000,
          floor: 5000,
          ceiling: 15000,
          channels: [],
        },
      ],
      null,
      2,
    ),
  )

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/flow/policies`)
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => {})
    fetch(`${INDEXER}/flow/events`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => {})
  }, [])

  const runSim = () => {
    try {
      const r = runFlowSimulation(JSON.parse(scenario) as SimHolon[], {
        epochs: 12,
      })
      setReport(JSON.stringify(r, null, 2))
    } catch (e) {
      setReport(`error: ${(e as Error).message}`)
    }
  }

  return (
    <LargeLayout>
      <Head title={`Flow Funding — ${env.META_TITLE}`} />
      <Box mb={8}>
        <Heading as="h1" size="xl" mb={2}>
          Flow Funding
        </Heading>
        <Text color="gray.500" maxW="3xl">
          Continuous, homeostatic circulation: a node above its ceiling flows
          surplus to its dependents; below-floor nodes draw support. Matching
          rounds are episodic — flows are peristaltic.
        </Text>
      </Box>

      <Heading as="h2" size="md" mb={4}>
        Armed policies
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
        {policies.map((p) => (
          <Card key={p.node}>
            <CardBody>
              <Heading as="h3" size="sm" mb={1}>
                {p.node}
              </Heading>
              <Text fontSize="sm">
                band [{p.floor} — {p.ceiling}] gradient {p.gradient}
              </Text>
              <Text fontSize="sm" color="gray.500">
                caps: {p.per_claimant_cap * 100}%/claimant,{' '}
                {p.per_epoch_cap * 100}%/epoch
              </Text>
            </CardBody>
          </Card>
        ))}
        {policies.length === 0 && (
          <Card>
            <CardBody>
              <Text color="gray.500">No policies armed yet.</Text>
            </CardBody>
          </Card>
        )}
      </SimpleGrid>

      <Heading as="h2" size="md" mb={4}>
        Simulate before arming
      </Heading>
      <Card mb={8}>
        <CardBody>
          <Textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            fontFamily="mono"
            fontSize="xs"
            minH="220px"
          />
          <Button mt={3} colorScheme="brand" onClick={runSim}>
            Run 12-epoch simulation
          </Button>
          {report && (
            <Code
              display="block"
              whiteSpace="pre"
              mt={3}
              p={3}
              maxH="300px"
              overflow="auto"
              fontSize="xs"
            >
              {report}
            </Code>
          )}
        </CardBody>
      </Card>

      <Heading as="h2" size="md" mb={4}>
        Recent flows
      </Heading>
      {events.map((e, i) => (
        <Card key={i} mb={2}>
          <CardBody py={3}>
            <Text fontSize="sm">
              epoch {e.epoch}: {e.from_node} → {e.to_node} — {e.amount} (
              {e.status})
            </Text>
          </CardBody>
        </Card>
      ))}
    </LargeLayout>
  )
}

export default FlowPage
