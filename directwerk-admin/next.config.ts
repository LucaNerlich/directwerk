import type {NextConfig} from 'next'

import {extraOptimizePackageImports} from '../packages/next-config/optimizePackageImports'

// Content-Security-Policy is set per-request with a nonce in proxy.ts.
const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui', '@directwerk/api'],
    experimental: {
        optimizePackageImports: [...extraOptimizePackageImports],
    },
}

export default nextConfig
