import MediaHubNav from '@/components/media/MediaHubNav'

export default function MediaLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return <MediaHubNav>{children}</MediaHubNav>
}
