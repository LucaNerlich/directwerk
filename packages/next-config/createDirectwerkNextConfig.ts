import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {extraOptimizePackageImports} from './optimizePackageImports'

const directwerkTranspilePackages = ['@directwerk/ui', '@directwerk/api'] as const

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Per-request CSP for apps that keep access tokens in sessionStorage. Callers
 * must set this on both the incoming request and outgoing response so Next.js
 * can apply the nonce to its generated scripts.
 */
export function createDirectwerkContentSecurityPolicy(
    nonce: string,
    isDevelopment: boolean,
): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        `connect-src 'self' https:${isDevelopment ? ' http: ws: wss:' : ''}`,
        "media-src 'self' blob: https:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
    ].join('; ')
}

/**
 * Baseline response headers applied to every page/API route. These are
 * deliberately CSP-free: apps that need CSP add it at their own response
 * boundary, using a per-request proxy nonce or app-specific headers.
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
