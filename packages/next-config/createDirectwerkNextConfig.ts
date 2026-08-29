import {extraOptimizePackageImports} from './optimizePackageImports'

export const directwerkTranspilePackages = ['@directwerk/ui', '@directwerk/api'] as const

/**
 * Shared Next.js defaults for Directwerk apps (no `next` import — apps spread into NextConfig).
 */
export function createDirectwerkNextConfig() {
    return {
        reactCompiler: true,
        transpilePackages: [...directwerkTranspilePackages],
        experimental: {
            optimizePackageImports: [...extraOptimizePackageImports],
        },
    }
}
