import {
    archiveArticle,
    cancelScheduleArticle,
    deleteArticle,
    discardArticleDraft,
    publishArticle,
    scheduleArticle,
    unarchiveArticle,
    unpublishArticle,
} from '@/lib/api/writeApi'
import type {ContentEditorDescriptor} from '@/components/publication/content-editor/types'
import type {ArticleDetail} from '@directwerk/api/types'

/** Static article content-type descriptor for {@link PublicationContentEditor}. */
export const articleContentEditorDescriptor: ContentEditorDescriptor<ArticleDetail> =
    {
        kind: 'article',
        deskEntity: 'ARTICLE',
        labels: {
            contentLabel: 'Beitrag',
            loadingMessage: 'Beitrag wird geladen…',
            deleteErrorMessage: 'Beitrag konnte nicht gelöscht werden.',
            coverAlt: (title) =>
                title.trim().length > 0 ? `Titelbild: ${title}` : 'Titelbild',
            previewUrlHintLive: 'Live-URL des Beitrags:',
            previewUrlHintDraft: 'So lautet die URL nach dem Veröffentlichen:',
            publishedLinksTitle: 'Öffentliche Links',
        },
        paths: {
            list: '/write/articles',
            editor: (id) => `/write/articles/${id}`,
        },
        api: {
            // Lazy wrappers keep descriptor init compatible with partial vi.mock
            // surfaces in ArticleEditor tests (same as deferred handler use before).
            publish: (id, options) => publishArticle(id, options),
            schedule: (id, options) => scheduleArticle(id, options),
            cancelSchedule: (id) => cancelScheduleArticle(id),
            unpublish: (id) => unpublishArticle(id),
            archive: (id) => archiveArticle(id),
            unarchive: (id) => unarchiveArticle(id),
            discardDraft: (id) => discardArticleDraft(id),
            delete: (id) => deleteArticle(id),
        },
    }
