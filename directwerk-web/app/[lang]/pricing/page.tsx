import {connection} from 'next/server'

import {fetchPublicProductsServer} from '@/lib/site/fetchPublicContentServer'
import {fetchPublicLevelsServer} from '@/lib/site/fetchPublicLevelsServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

import PricingClient from './pricing-client'

/**
 * Server-seeds public products and levels so anonymous pricing first paint is
 * not a client JS + BFF waterfall (#855).
 */
export default async function PricingPage(): Promise<React.JSX.Element> {
    await connection()

    let initialProducts: Awaited<ReturnType<typeof fetchPublicProductsServer>> = null
    let initialLevels: Awaited<ReturnType<typeof fetchPublicLevelsServer>> = null
    try {
        const host = await getTenantHost()
        if (host !== null && host.length > 0) {
            ;[initialProducts, initialLevels] = await Promise.all([
                fetchPublicProductsServer(host),
                fetchPublicLevelsServer(host),
            ])
        }
    } catch {
        initialProducts = null
        initialLevels = null
    }

    return (
        <PricingClient
            initialLevels={initialLevels}
            initialProducts={initialProducts}
        />
    )
}
