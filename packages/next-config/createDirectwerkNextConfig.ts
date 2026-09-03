import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {extraOptimizePackageImports} from './optimizePackageImports'

const directwerkTranspilePackages = ['@directwerk/ui', '@directwerk/api'] as const

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Baseline response headers applied to every page/API route. These are
 * deliberately CSP-free (apps that need CSP set it themselves: admin via
 * proxy.ts nonce, homepage via its own headers block) so this stays
 * non-breaking for all consumers.
 */
export function directwerkSecurityHeaders(): {key: string; value: string}[] {
    return [
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
        {key: 'X-Frame-Options', value: 'SAMEORIGIN'},
        {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
        },
    ]
}

/**
 * Shared Next.js defaults for Directwerk apps (no `next` import — apps spread into NextConfig).
 */
export function createDirectwerkNextConfig() {
    return {
        reactCompiler: true,
        transpilePackages: [...directwerkTranspilePackages],
        outputFileTracingRoot: monorepoRoot,
        experimental: {
            optimizePackageImports: [...extraOptimizePackageImports],
        },
        async headers() {
            return [
                {
                    source: '/:path*',
                    headers: directwerkSecurityHeaders(),
                },
            ]
        },
    }
}
