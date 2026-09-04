import path from 'node:path'
import {fileURLToPath} from 'node:url'

import type { NextConfig } from 'next'

import {extraOptimizePackageImports} from '../packages/next-config/optimizePackageImports'

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Contact form + ALTCHA talk to the API origin (localhost in dev).
const apiOrigin =
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const apiWsOrigin = apiOrigin.startsWith('http://')
    ? apiOrigin.replace('http://', 'ws://')
    : apiOrigin.replace('https://', 'wss://')

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui'],
    outputFileTracingRoot: monorepoRoot,
    experimental: {
        optimizePackageImports: [...extraOptimizePackageImports],
    },
    async headers() {
        // NOTE: script-src uses 'unsafe-inline' (no nonce middleware here).
        // This page is statically prerendered, so per-request nonces cannot
        // work — the HTML is built once at build time. A static nonce-less
        // CSP ('self' only) blocks Next.js's own inline bootstrap scripts and
        // leaves a fully static, non-hydrated page; 'strict-dynamic' is worse
        // (it also disables 'self' for runtime-injected chunks). The marketing
        // site renders no user input, so inline-script risk stays minimal.
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "font-src 'self'",
                            "connect-src 'self' https: " + apiOrigin + ' ' + apiWsOrigin,
                            "worker-src 'self' blob:",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join('; '),
                    },
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
