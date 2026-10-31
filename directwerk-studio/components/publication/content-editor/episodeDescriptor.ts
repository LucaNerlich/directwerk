import {
    archiveEpisode,
    cancelScheduleEpisode,
    deleteEpisode,
    discardEpisodeDraft,
    publishEpisode,
    scheduleEpisode,
    unarchiveEpisode,
    unpublishEpisode,
} from '@/lib/api/podcastApi'
import type {ContentEditorDescriptor} from '@/components/publication/content-editor/types'
import type {EpisodeDetail} from '@directwerk/api/types'

/** Static episode content-type descriptor for {@link PublicationContentEditor}. */
export const episodeContentEditorDescriptor: ContentEditorDescriptor<EpisodeDetail> =
    {
        kind: 'episode',
        deskEntity: 'EPISODE',
        labels: {
            contentLabel: 'Folge',
            loadingMessage: 'Folge wird geladen…',
            deleteErrorMessage: 'Folge konnte nicht gelöscht werden.',
            coverAlt: (title) =>
                title.trim().length > 0 ? `Cover: ${title}` : 'Folgen-Cover',
            previewUrlHintLive: 'Live-URL der Folge:',
            previewUrlHintDraft: 'So lautet die URL nach dem Veröffentlichen:',
            publishedLinksTitle: 'Öffentliche Links',
        },
        paths: {
            list: '/podcast/episodes',
            editor: (id) => `/podcast/episodes/${id}`,
        },
        api: {
            // Lazy wrappers keep descriptor init compatible with partial vi.mock
            // surfaces in EpisodeEditor tests (same as deferred handler use before).
            publish: (id, options) => publishEpisode(id, options),
            schedule: (id, options) => scheduleEpisode(id, options),
            cancelSchedule: (id) => cancelScheduleEpisode(id),
            unpublish: (id) => unpublishEpisode(id),
            archive: (id) => archiveEpisode(id),
            unarchive: (id) => unarchiveEpisode(id),
            discardDraft: (id) => discardEpisodeDraft(id),
            delete: (id) => deleteEpisode(id),
        },
    }
