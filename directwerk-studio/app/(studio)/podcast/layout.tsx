import DeskGate from '@/components/studio/DeskGate'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {notFound} from 'next/navigation'

export default async function PodcastLayout({
    children,
}: {
    children: React.ReactNode
}): Promise<React.JSX.Element> {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)

    if (!config.studioDesks.includes('PODCAST')) {
        notFound()
    }

    return <DeskGate desk="PODCAST">{children}</DeskGate>
}
