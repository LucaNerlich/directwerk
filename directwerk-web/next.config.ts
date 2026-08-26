import type {NextConfig} from 'next'

import {buildMediaImageRemotePatterns} from './lib/mediaImageRemotePatterns'

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui', '@directwerk/api'],
    images: {
        remotePatterns: buildMediaImageRemotePatterns(
            process.env.MEDIA_IMAGE_REMOTE_HOSTS
        ),
    },
}

export default nextConfig
