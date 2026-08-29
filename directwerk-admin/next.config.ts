import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

// Content-Security-Policy is set per-request with a nonce in proxy.ts.
const nextConfig: NextConfig = {
    ...createDirectwerkNextConfig(),
}

export default nextConfig
