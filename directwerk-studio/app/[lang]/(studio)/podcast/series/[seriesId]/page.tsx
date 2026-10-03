import SeriesEditor from '@/components/podcast/SeriesEditor'

export default async function SeriesDetailPage({
    params,
}: {
    params: Promise<{seriesId: string}>
}): Promise<React.JSX.Element> {
    const {seriesId: seriesIdRaw} = await params
    if (!/^\d+$/.test(seriesIdRaw)) {
        return <p>Ungültige Sendung.</p>
    }
    const seriesId = Number(seriesIdRaw)
    if (!Number.isSafeInteger(seriesId) || seriesId < 1) {
        return <p>Ungültige Sendung.</p>
    }

    return <SeriesEditor seriesId={seriesId} />
}
