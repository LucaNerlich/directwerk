import DeskGate from '@/components/studio/DeskGate'

export default function WriteLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return <DeskGate desk="WRITE">{children}</DeskGate>
}
