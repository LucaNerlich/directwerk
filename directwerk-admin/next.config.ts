import type {NextConfig} from 'next'

// Content-Security-Policy is set per-request with a nonce in proxy.ts.
const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui'],
}

export default nextConfig
