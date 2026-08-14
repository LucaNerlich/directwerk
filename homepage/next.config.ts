import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui'],
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'wasm-unsafe-eval'",
                            "style-src 'self'",
                            "img-src 'self' data: https:",
                            "font-src 'self'",
                            "connect-src 'self'",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join('; '),
                    },
                ],
            },
        ]
    },
}

export default nextConfig
