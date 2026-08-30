import DeskGate from '@/components/studio/DeskGate'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'
import {notFound} from 'next/navigation'

export default async function PodcastLayout({
    children,
}: {
    children: React.ReactNode
}): Promise<React.JSX.Element> {
    const {config} = await requireStudioSiteConfig()

    if (!config.studioDesks.includes('PODCAST')) {
        notFound()
    }

    return <DeskGate desk="PODCAST">{children}</DeskGate>
}
