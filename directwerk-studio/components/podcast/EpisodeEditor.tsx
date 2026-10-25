'use client'

import PublicationContentEditor from '@/components/publication/content-editor/PublicationContentEditor'
import {useEpisodeContentEditor} from '@/components/publication/content-editor/useEpisodeContentEditor'

/**
 * Creates or edits a podcast episode, including its metadata, publication status, audio, cover image, and classifications.
 *
 * @param episodeId - The identifier of the episode to edit; omitted when creating a new episode.
 */
export default function EpisodeEditor({
    episodeId,
}: {
    episodeId?: number
}): React.JSX.Element {
    const model = useEpisodeContentEditor(episodeId)
    return <PublicationContentEditor model={model} />
}
