const nextTranslate = require('next-translate-plugin')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const removeImports = require('next-remove-imports')()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'standalone',
  experimental: {
    externalDir: true,
  },
  images: {
    minimumCacheTTL: 3600 * 24 * 365, // 1 year
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, options) => {
    if (!options.isServer) {
      if (!config.resolve) config.resolve = {}
      if (!config.resolve.fallback) config.resolve.fallback = {}
      config.resolve.fallback.fs = false
    }
    if (!config.resolve) config.resolve = {}
    if (!config.resolve.alias) config.resolve.alias = {}
    // unlicensed upstream SDK → local implementation over lssvm2 + indexer
    config.resolve.alias['@liteflow/react$'] = require('path').resolve(
      __dirname,
      'src/liteflow.tsx',
    )
    config.resolve.alias['@liteflow/react/dist/useBatchPurchase$'] =
      require('path').resolve(__dirname, 'src/liteflow-batch.ts')
    config.resolve.alias['@liteflow/core$'] = require('path').resolve(
      __dirname,
      'src/liteflow-core.ts',
    )
    config.resolve.alias['@liteflow/core/dist/utils/transaction$'] =
      require('path').resolve(__dirname, 'src/liteflow-tx.ts')
    return config
  },
  reactStrictMode: true,
}

module.exports = nextTranslate(withBundleAnalyzer(removeImports(nextConfig)))
