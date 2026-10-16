import {
  Box,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import Head from '../components/Head'
import useEnvironment from '../hooks/useEnvironment'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type Fund = { id: string; name: string; pool: number; projects: string[] }

const FundsPage: NextPage = () => {
  const env = useEnvironment()
  const [funds, setFunds] = useState<Fund[]>([])

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/funds`)
      .then((r) => r.json())
      .then(setFunds)
      .catch(() => setFunds([]))
  }, [])

  return (
    <LargeLayout>
      <Head title={`Funds — ${env.META_TITLE}`} />
      <Box mb={8}>
        <Heading as="h1" size="xl" mb={2}>
          Funds
        </Heading>
        <Text color="gray.500">
          Curated collections of projects. Each fund sets its own allocation
          rule: equal split, zoning, quadratic match, or cap.
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {funds.map((f) => (
          <Card key={f.id}>
            <CardBody>
              <Heading as="h3" size="md" mb={2}>
                {f.name}
              </Heading>
              <Stat>
                <StatNumber>{f.pool}</StatNumber>
                <StatLabel>matching pool</StatLabel>
              </Stat>
              <Text mt={2} fontSize="sm" color="gray.500">
                {f.projects.length} projects
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
      {funds.length === 0 && (
        <Card>
          <CardBody>
            <Text color="gray.500">No active funds.</Text>
          </CardBody>
        </Card>
      )}
    </LargeLayout>
  )
}

export default FundsPage
