import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

// Content-Security-Policy is set per-request with a nonce in proxy.ts.
// X-Frame-Options is defined here (DENY) so the admin console is never framed;
// the shared config is the single source of the frame policy, so proxy.ts must
// not set X-Frame-Options as well.
const baseConfig = createDirectwerkNextConfig()

const nextConfig: NextConfig = {
    ...baseConfig,
    experimental: {
        ...baseConfig.experimental,
        // The storage test upload posts through a server action; Next's 1 MB default rejected
        // every realistic file before the 10 MB pre-check ran (#1016). The proxy buffers the
        // same request first and defaults to 10 MiB, so it needs headroom above the action
        // limit or a file at the cap arrives truncated (#1016 review).
        serverActions: {bodySizeLimit: '11mb'},
        proxyClientMaxBodySize: '12mb',
    },
}

export default nextConfig
