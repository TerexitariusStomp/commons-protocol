import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Head from '../components/Head'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

const ProposeFundPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const router = useRouter()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const toast = useToast()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mechanism, setMechanism] = useState<'qf' | 'match' | 'multiplier'>('qf')
  const [param, setParam] = useState(100)
  const [pledgeGoal, setPledgeGoal] = useState(1000)
  const [pointsGoal, setPointsGoal] = useState(1000)
  const [balance, setBalance] = useState<number | undefined>()
  const [minPoints, setMinPoints] = useState(1000)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!INDEXER) return
    fetch(`${INDEXER}/season`)
      .then((r) => r.json())
      .then((s) => setMinPoints(s.proposeMinPoints ?? 1000))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!INDEXER || !address) return
    fetch(`${INDEXER}/points/${address}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balance))
      .catch(() => {})
  }, [address])

  const submit = async () => {
    if (!address) return
    setBusy(true)
    try {
      const clean = id.toLowerCase().replace(/[^a-z0-9-]/g, '')
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons propose fund\nFund: ${clean}\nWallet: ${address.toLowerCase()}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/funds/propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: clean,
          name,
          description,
          mechanism,
          mechParam:
            mechanism === 'match'
              ? { cap: param }
              : mechanism === 'multiplier'
                ? { x: param }
                : undefined,
          pledgeGoal,
          pointsGoal,
          wallet: address,
          ts,
          signature,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      toast({ title: t('propose.created'), status: 'success' })
      void router.push(`/funds/${body.id}`)
    } catch (e) {
      toast({
        title: t('propose.error'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const gated = balance !== undefined && balance < minPoints

  return (
    <LargeLayout>
      <Head title={t('propose.title')} />
      <Box py={10} maxW="lg" mx="auto">
        <Heading variant="title" mb={2}>
          {t('propose.title')}
        </Heading>
        <Text color="gray.600" fontSize="sm" mb={8}>
          {t('propose.desc', { points: minPoints.toLocaleString() })}
        </Text>
        <Card>
          <CardBody>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.slug')}</FormLabel>
              <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="my-fund" rounded="xl" />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.name')}</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} rounded="xl" />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.description')}</FormLabel>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rounded="xl" rows={3} />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('propose.mechanism')}</FormLabel>
              <Select
                value={mechanism}
                onChange={(e) => setMechanism(e.target.value as typeof mechanism)}
                rounded="xl"
              >
                <option value="qf">{t('how.mech.qf.name')}</option>
                <option value="match">{t('how.mech.match.name')}</option>
                <option value="multiplier">{t('how.mech.multiplier.name')}</option>
              </Select>
            </FormControl>
            {mechanism !== 'qf' && (
              <FormControl mb={4}>
                <FormLabel fontSize="sm">
                  {mechanism === 'match' ? t('propose.cap') : t('propose.multiplier')}
                </FormLabel>
                <NumberInput min={0} value={param} onChange={(_, n) => setParam(n || 0)}>
                  <NumberInputField rounded="xl" />
                </NumberInput>
              </FormControl>
            )}
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('propose.pledgeGoal')}</FormLabel>
              <NumberInput min={0} value={pledgeGoal} onChange={(_, n) => setPledgeGoal(n || 0)}>
                <NumberInputField rounded="xl" />
              </NumberInput>
            </FormControl>
            <FormControl mb={6}>
              <FormLabel fontSize="sm">{t('propose.pointsGoal')}</FormLabel>
              <NumberInput min={0} value={pointsGoal} onChange={(_, n) => setPointsGoal(n || 0)}>
                <NumberInputField rounded="xl" />
              </NumberInput>
            </FormControl>
            {gated && (
              <Text color="orange.500" fontSize="sm" mb={4}>
                {t('propose.gated', { points: minPoints.toLocaleString(), balance: balance ?? 0 })}
              </Text>
            )}
            <Button
              colorScheme="brand"
              w="full"
              rounded="xl"
              isLoading={busy}
              isDisabled={!address || !id || !name || gated}
              onClick={submit}
            >
              {address ? t('propose.submit') : t('points.connect')}
            </Button>
          </CardBody>
        </Card>
      </Box>
    </LargeLayout>
  )
}

export default ProposeFundPage
