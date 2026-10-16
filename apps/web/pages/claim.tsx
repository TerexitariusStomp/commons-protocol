import {
  Badge,
  Box,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Head from '../components/Head'
import useEnvironment from '../hooks/useEnvironment'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

type Claim = { project: string; shortfall: number; status: string }

const ClaimPage: NextPage = () => {
  const env = useEnvironment()
  const { address } = useAccount()
  const [claims, setClaims] = useState<Claim[]>([])

  useEffect(() => {
    if (!INDEXER || !address) return
    fetch(`${INDEXER}/claims?wallet=${address}`)
      .then((r) => r.json())
      .then(setClaims)
      .catch(() => setClaims([]))
  }, [address])

  return (
    <LargeLayout>
      <Head title={`Claim — ${env.META_TITLE}`} />
      <Box mb={8}>
        <Heading as="h1" size="xl" mb={2}>
          Claim your place
        </Heading>
        <Text color="gray.500" maxW="2xl">
          Artizen projects are pre-loaded on the graph. Add the Commons bot to
          your project&apos;s Telegram channel to start a consent-based claim.
          The window is open for six months; unclaimed shares stay with the Pot.
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {claims.map((c) => (
          <Card key={c.project}>
            <CardBody>
              <Heading as="h3" size="md" mb={2}>
                {c.project}
              </Heading>
              <Badge mt={2} colorScheme={c.status === 'claimed' ? 'green' : 'yellow'}>
                {c.status}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
      {!address && (
        <Card mt={4}>
          <CardBody>
            <Text color="gray.500">
              Connect a wallet to see claimable projects.
            </Text>
          </CardBody>
        </Card>
      )}
    </LargeLayout>
  )
}

export default ClaimPage
