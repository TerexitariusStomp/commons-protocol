import { chakra, ChakraComponent, HTMLChakraProps } from '@chakra-ui/react'
import NextImage, { ImageProps as NextImageProps } from 'next/image'
import { FC, SyntheticEvent, useMemo, useState } from 'react'

export type ImageProps = NextImageProps &
  Omit<HTMLChakraProps<'img'>, keyof NextImageProps>

const ChakraNextImage: ChakraComponent<
  'img',
  Omit<NextImageProps, 'objectFit'>
> = chakra(NextImage, {
  shouldForwardProp: (prop) =>
    [
      'src',
      'alt',
      'width',
      'height',
      'fill',
      'loader',
      'quality',
      'priority',
      'loading',
      'placeholder',
      'blurDataURL',
      'unoptimized',
      'onLoadingComplete',
      'sizes',
      'onError',
    ].includes(prop),
})

// Public IPFS gateways tried in order, client-side, when an ipfs src fails.
const IPFS_GWS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.filebase.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://ipfs.io/ipfs/',
]

const cidPathOf = (src: unknown): string | null => {
  const s = String(src ?? '')
  if (s.startsWith('ipfs://')) return s.slice(7)
  const i = s.indexOf('/ipfs/')
  return i >= 0 ? s.slice(i + 6) : null
}

/* eslint-disable deprecation/deprecation */
const Image: FC<ImageProps> = (allProps) => {
  const { src, onError, style, objectFit, ...props } = allProps
  const cidPath = useMemo(() => cidPathOf(src), [src])
  const [gwIndex, setGwIndex] = useState(0)

  const resolved = cidPath
    ? `${IPFS_GWS[Math.min(gwIndex, IPFS_GWS.length - 1)]}${cidPath}`
    : src

  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (cidPath && gwIndex < IPFS_GWS.length - 1) {
      setGwIndex(gwIndex + 1)
      return
    }
    onError?.(e)
  }

  return (
    <ChakraNextImage
      src={resolved}
      onError={handleError}
      style={{ ...style, objectFit: objectFit as React.CSSProperties['objectFit'] }}
      {...props}
    />
  )
}


export default Image
/* eslint-enable deprecation/deprecation */
