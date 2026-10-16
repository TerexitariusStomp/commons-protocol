import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Head from '../components/Head'
import LargeLayout from '../layouts/large'

const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL || ''

const NewProjectPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const router = useRouter()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const toast = useToast()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!address) return
    setBusy(true)
    try {
      const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
      const ts = Math.floor(Date.now() / 1000)
      const message = `Commons create project\nSlug: ${clean}\nWallet: ${address.toLowerCase()}\nTs: ${ts}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`${INDEXER}/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: clean,
          name,
          description,
          goal: goal ? Number(goal) : undefined,
          wallet: address,
          ts,
          signature,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'failed')
      toast({ title: t('new.created'), status: 'success' })
      void router.push(`/projects/${body.slug}`)
    } catch (e) {
      toast({
        title: t('new.error'),
        description: e instanceof Error ? e.message : undefined,
        status: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <LargeLayout>
      <Head title={t('new.title')} />
      <Box py={10} maxW="lg" mx="auto">
        <Heading variant="title" mb={2}>
          {t('new.title')}
        </Heading>
        <Text color="gray.600" fontSize="sm" mb={8}>
          {t('new.desc')}
        </Text>
        <Card>
          <CardBody>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.slug')}</FormLabel>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-project"
                rounded="xl"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.name')}</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} rounded="xl" />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel fontSize="sm">{t('new.description')}</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rounded="xl"
                rows={4}
              />
            </FormControl>
            <FormControl mb={6}>
              <FormLabel fontSize="sm">{t('new.goal')}</FormLabel>
              <Input
                type="number"
                min={0}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="5000"
                rounded="xl"
              />
            </FormControl>
            <Button
              colorScheme="brand"
              w="full"
              rounded="xl"
              isLoading={busy}
              isDisabled={!address || !slug || !name}
              onClick={submit}
            >
              {address ? t('new.submit') : t('points.connect')}
            </Button>
          </CardBody>
        </Card>
      </Box>
    </LargeLayout>
  )
}

export default NewProjectPage
