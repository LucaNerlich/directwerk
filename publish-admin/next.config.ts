import type {NextConfig} from 'next'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@publish/ui'],
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            // React/Next dev tooling needs eval(); only when NODE_ENV=development.
                            isDev
                                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                                : "script-src 'self' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data:",
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
