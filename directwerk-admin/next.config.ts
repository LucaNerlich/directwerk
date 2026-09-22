import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

// Content-Security-Policy is set per-request with a nonce in proxy.ts.
// X-Frame-Options is defined here (DENY) so the admin console is never framed;
// the shared config is the single source of the frame policy, so proxy.ts must
// not set X-Frame-Options as well.
const nextConfig: NextConfig = {
    ...createDirectwerkNextConfig({frameOptions: 'DENY'}),
}

export default nextConfig
