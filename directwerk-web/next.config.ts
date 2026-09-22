import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

import {buildMediaImageRemotePatterns} from './lib/mediaImageRemotePatterns'

const sharedConfig = createDirectwerkNextConfig()

const nextConfig: NextConfig = {
    ...sharedConfig,
    // `sanitize-html` depends on PostCSS, which Next externalizes by default.
    // Bundling it keeps the production artifact portable when `pnpm deploy`
    // moves `.next` out of the monorepo build directory.
    transpilePackages: [...sharedConfig.transpilePackages, 'postcss'],
    images: {
        maximumRedirects: 0,
        remotePatterns: buildMediaImageRemotePatterns(
            process.env.MEDIA_IMAGE_REMOTE_HOSTS
        ),
    },
}

export default nextConfig
