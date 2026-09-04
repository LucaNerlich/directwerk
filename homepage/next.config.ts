import path from 'node:path'
import {fileURLToPath} from 'node:url'

import type { NextConfig } from 'next'

import {extraOptimizePackageImports} from '../packages/next-config/optimizePackageImports'

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui'],
    outputFileTracingRoot: monorepoRoot,
    experimental: {
        optimizePackageImports: [...extraOptimizePackageImports],
    },
    async headers() {
        // NOTE: no static Content-Security-Policy here — it would block
        // Next.js's own inline bootstrap scripts and kill hydration. CSP is
        // served per-request with a nonce by proxy.ts instead.
        return [
            {
                source: '/:path*',
                headers: [
                    {key: 'X-Content-Type-Options', value: 'nosniff'},
                    {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
                    {key: 'X-Frame-Options', value: 'SAMEORIGIN'},
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=()',
                    },
                ],
            },
        ]
    },
}

export default nextConfig
