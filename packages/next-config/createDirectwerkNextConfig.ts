import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {extraOptimizePackageImports} from './optimizePackageImports'

export const directwerkTranspilePackages = ['@directwerk/ui', '@directwerk/api'] as const

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Shared Next.js defaults for Directwerk apps (no `next` import — apps spread into NextConfig).
 */
export function createDirectwerkNextConfig() {
    return {
        reactCompiler: true,
        transpilePackages: [...directwerkTranspilePackages],
        output: 'standalone' as const,
        outputFileTracingRoot: monorepoRoot,
        experimental: {
            optimizePackageImports: [...extraOptimizePackageImports],
        },
    }
}
