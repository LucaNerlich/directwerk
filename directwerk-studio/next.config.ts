import type {NextConfig} from 'next'

import {createDirectwerkNextConfig} from '../packages/next-config/createDirectwerkNextConfig'

const nextConfig: NextConfig = {
    ...createDirectwerkNextConfig(),
    async redirects() {
        return [
            {
                // Former workspace-picker route; the picker now lives on `/login`.
                source: '/select-tenant',
                destination: '/login',
                permanent: true,
            },
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
