import {
  Box,
  Divider,
  Heading,
  Link as ChakraLink,
  SkeletonText,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
  useColorMode,
} from '@chakra-ui/react'
import { MarkdownPreviewProps } from '@uiw/react-markdown-preview'
import { NextPage } from 'next'
import useTranslation from 'next-translate/useTranslation'
import dynamic from 'next/dynamic'
import { FC, useEffect, useMemo, useState } from 'react'
import Head from '../components/Head'
import LargeLayout from '../layouts/large'

const MDPreview = dynamic<MarkdownPreviewProps>(
  () => import('@uiw/react-markdown-preview'),
  { ssr: false, loading: () => <SkeletonText noOfLines={10} spacing={4} /> },
)

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const headingText = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(headingText).join('')
  if (children && typeof children === 'object' && 'props' in children)
    return headingText((children as { props: { children?: React.ReactNode } }).props.children)
  return ''
}

const AnchoredHeading: FC<{ as: 'h1' | 'h2' | 'h3'; children?: React.ReactNode }> = ({
  as,
  children,
}) => {
  const id = slug(headingText(children))
  const sizes = { h1: '2xl', h2: 'xl', h3: 'lg' } as const
  return (
    <Heading
      as={as}
      id={id}
      size={sizes[as]}
      mt={as === 'h1' ? 10 : 8}
      mb={3}
      pt={4}
      sx={{ scrollMarginTop: '96px' }}
    >
      {children}
    </Heading>
  )
}

const Blockquote: FC<{ children?: React.ReactNode }> = ({ children }) => (
  <Box
    borderLeft="4px solid"
    borderColor="brand.500"
    bg="brand.50"
    _dark={{ bg: 'whiteAlpha.100' }}
    px={4}
    py={2}
    my={4}
    borderRadius="md"
  >
    {children}
  </Box>
)

type TocItem = { id: string; label: string; part?: boolean }

const parseToc = (md: string): TocItem[] => {
  const items: TocItem[] = []
  for (const line of md.split('\n')) {
    const part = /^# Part (.+)$/.exec(line.trim())
    if (part?.[1]) {
      items.push({ id: '', label: `Part ${part[1]}`, part: true })
      continue
    }
    const h = /^## (\d+\..+)$/.exec(line.trim())
    if (h?.[1] && !items.some((i) => i.label === h[1]))
      items.push({ id: slug(h[1]), label: h[1] })
  }
  return items
}

const WhitepaperPage: NextPage = () => {
  const { t } = useTranslation('templates')
  const { colorMode } = useColorMode()
  const [source, setSource] = useState<string>()

  useEffect(() => {
    fetch('/whitepaper.md')
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(setSource)
      .catch(() => setSource(''))
  }, [])

  const toc = useMemo(() => (source ? parseToc(source) : []), [source])

  return (
    <LargeLayout>
      <Head
        title={t('whitepaper.title')}
        description={t('whitepaper.desc')}
      />
      <chakra.div display="flex" gap={10} py={10} px={4} alignItems="flex-start">
        <chakra.nav
          display={{ base: 'none', lg: 'block' }}
          position="sticky"
          top="90px"
          w="240px"
          flexShrink={0}
          maxH="calc(100vh - 120px)"
          overflowY="auto"
          fontSize="sm"
        >
          <Text fontWeight="bold" mb={3}>
            {t('whitepaper.toc')}
          </Text>
          {toc.map((item, i) =>
            item.part ? (
              <Text key={i} mt={4} mb={1} fontWeight="semibold" fontSize="xs" textTransform="uppercase" color="gray.500">
                {item.label}
              </Text>
            ) : (
              <ChakraLink
                key={i}
                href={`#${item.id}`}
                display="block"
                py={0.5}
                color="gray.600"
                _dark={{ color: 'gray.400' }}
                _hover={{ color: 'brand.500' }}
              >
                {item.label}
              </ChakraLink>
            ),
          )}
        </chakra.nav>

        <Box flex={1} minW={0} maxW="860px">
          {source === undefined ? (
            <SkeletonText noOfLines={12} spacing={4} />
          ) : source === '' ? (
            <Text>{t('whitepaper.error')}</Text>
          ) : (
            <div data-color-mode={colorMode}>
              <MDPreview
                source={source}
                components={{
                  h1: (p) => <AnchoredHeading as="h1" {...p} />,
                  h2: (p) => <AnchoredHeading as="h2" {...p} />,
                  h3: (p) => <AnchoredHeading as="h3" {...p} />,
                  blockquote: (p) => <Blockquote {...p} />,
                  hr: () => <Divider my={8} />,
                  a: (p) => <ChakraLink color="brand.500" {...p} />,
                  table: (p) => (
                    <Box overflowX="auto" my={4}>
                      <Table variant="simple" size="sm" {...p} />
                    </Box>
                  ),
                  thead: (p) => <Thead {...p} />,
                  tbody: (p) => <Tbody {...p} />,
                  tr: (p) => <Tr {...p} />,
                  th: (p) => <Th {...p} />,
                  td: (p) => <Td {...p} />,
                }}
              />
            </div>
          )}
        </Box>
      </chakra.div>
    </LargeLayout>
  )
}

export default WhitepaperPage
