import EpisodeEditor from '@/components/podcast/EpisodeEditor'

export default async function EpisodeDetailPage({
    params,
}: {
    params: Promise<{episodeId: string}>
}) {
    const {episodeId: episodeIdRaw} = await params
    const episodeId = Number(episodeIdRaw)
    if (!Number.isSafeInteger(episodeId) || episodeId < 1) {
        return <p>Ungültige Folge.</p>
    }

    return <EpisodeEditor episodeId={episodeId} />
}
