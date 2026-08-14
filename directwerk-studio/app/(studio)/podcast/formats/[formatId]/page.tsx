import FormatEditor from '@/components/podcast/FormatEditor'

interface FormatPageProps {
    params: Promise<{formatId: string}>
}

/**
 * Renders the format editor for a valid format route identifier.
 */
export default async function FormatPage({
    params,
}: FormatPageProps): Promise<React.JSX.Element> {
    const {formatId} = await params
    const parsed = Number.parseInt(formatId, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return <p>Ungültige Format-ID.</p>
    }

    return <FormatEditor formatId={parsed} />
}
