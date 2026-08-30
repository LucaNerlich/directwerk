import path from 'node:path'
import {fileURLToPath} from 'node:url'

import type { NextConfig } from 'next'

import {extraOptimizePackageImports} from '../packages/next-config/optimizePackageImports'

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const apiOrigin =
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui'],
    outputFileTracingRoot: monorepoRoot,
    experimental: {
        optimizePackageImports: [...extraOptimizePackageImports],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'wasm-unsafe-eval'",
                            "style-src 'self'",
                            "img-src 'self' data: https:",
                            "font-src 'self'",
                            "connect-src 'self' " + apiOrigin,
                            "worker-src 'self' blob:",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join('; '),
                    },
                ],
            },
        ]
    },
}

export default nextConfig
