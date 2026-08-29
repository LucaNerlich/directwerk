import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

import {buildMediaImageRemotePatterns} from './lib/mediaImageRemotePatterns'

const nextConfig: NextConfig = {
    ...createDirectwerkNextConfig(),
    images: {
        remotePatterns: buildMediaImageRemotePatterns(
            process.env.MEDIA_IMAGE_REMOTE_HOSTS
        ),
    },
}

export default nextConfig
