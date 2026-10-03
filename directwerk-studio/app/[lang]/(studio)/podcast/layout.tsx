import DeskGate from '@/components/studio/DeskGate'

export default function PodcastLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return <DeskGate desk="PODCAST">{children}</DeskGate>
}
