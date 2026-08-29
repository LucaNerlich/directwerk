import type {NextConfig} from 'next'

import {extraOptimizePackageImports} from '../packages/next-config/optimizePackageImports'

import {buildMediaImageRemotePatterns} from './lib/mediaImageRemotePatterns'

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui', '@directwerk/api'],
    experimental: {
        optimizePackageImports: [...extraOptimizePackageImports],
    },
    images: {
        remotePatterns: buildMediaImageRemotePatterns(
            process.env.MEDIA_IMAGE_REMOTE_HOSTS
        ),
    },
}

export default nextConfig
