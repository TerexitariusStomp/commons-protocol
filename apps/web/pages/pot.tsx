import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useState } from 'react'
import { useAccount, useContractRead, useContractWrite } from 'wagmi'
import Head from '../components/Head'
import useEnvironment from '../hooks/useEnvironment'
import LargeLayout from '../layouts/large'

const POT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
] as const

const PotPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { address } = useAccount()
  const env = useEnvironment()
  const pot = process.env.NEXT_PUBLIC_POT_ADDRESS as `0x${string}` | undefined
  const [amt, setAmt] = useState('')
  const toast = useToast()

  const { data: totalAssets } = useContractRead({
    address: pot,
    abi: POT_ABI,
    functionName: 'totalAssets',
    enabled: !!pot,
  })
  const { data: supply } = useContractRead({
    address: pot,
    abi: POT_ABI,
    functionName: 'totalSupply',
    enabled: !!pot,
  })
  const { writeAsync } = useContractWrite({
    address: pot,
    abi: POT_ABI,
    functionName: 'deposit',
  })

  const deposit = async () => {
    if (!address || !amt || !writeAsync) return
    try {
      await writeAsync({ args: [BigInt(amt), address] })
      toast({ title: 'Deposited', status: 'success' })
    } catch (e) {
      toast({ title: (e as Error).message.slice(0, 140), status: 'error' })
    }
  }

  return (
    <LargeLayout>
      <Head title={`The Pot — ${env.META_TITLE}`} />
      <Box mb={8}>
        <Heading as="h1" size="xl" mb={2}>
          The Pot
        </Heading>
        <Text color="gray.500" maxW="2xl">
          Hold-or-exit endowment. Marketplace and pool fees grow every share;
          redeem to exit and burn.
        </Text>
        <Text color="gray.600" fontSize="sm" mt={3} maxW="2xl">
          {t('pot.wealth')}
        </Text>
        <Text color="gray.500" fontSize="xs" mt={2} maxW="2xl">
          {t('pot.endowNote', { points: '100' })}
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={8}>
        <Card>
          <CardBody>
            <Stat>
              <StatNumber>{totalAssets?.toString() ?? '—'}</StatNumber>
              <StatLabel>total assets</StatLabel>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatNumber>{supply?.toString() ?? '—'}</StatNumber>
              <StatLabel>shares</StatLabel>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
      <Card maxW="md">
        <CardBody>
          <FormControl>
            <FormLabel>Deposit amount (stable, wei)</FormLabel>
            <Input value={amt} onChange={(e) => setAmt(e.target.value)} />
          </FormControl>
          <Button
            mt={4}
            colorScheme="brand"
            isDisabled={!address || !pot || !amt}
            onClick={deposit}
          >
            Deposit
          </Button>
        </CardBody>
      </Card>
    </LargeLayout>
  )
}

export default PotPage
