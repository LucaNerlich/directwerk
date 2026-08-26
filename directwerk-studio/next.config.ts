import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
    reactCompiler: true,
    transpilePackages: ['@directwerk/ui', '@directwerk/api'],
    async redirects() {
        return [
            {
                source: '/manage/formats',
                destination: '/podcast/formats',
                permanent: true,
            },
            {
                source: '/manage/formats/new',
                destination: '/podcast/formats/new',
                permanent: true,
            },
            {
                source: '/manage/formats/:formatId',
                destination: '/podcast/formats/:formatId',
                permanent: true,
            },
        ]
    },
}

export default nextConfig
