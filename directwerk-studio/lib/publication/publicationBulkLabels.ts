import type {PublicationBulkActionLabels} from './usePublicationBulkActions'

export function createPublicationBulkLabels(
    contentLabel: string,
    contentLabelPlural: string,
): PublicationBulkActionLabels {
    return {
        publishSuccess: (count) =>
            count === 1
                ? `1 ${contentLabel} wurde veröffentlicht.`
                : `${count} ${contentLabelPlural} wurden veröffentlicht.`,
        unpublishSuccess: (count) =>
            count === 1
                ? `1 ${contentLabel} wurde zurückgezogen (Entwurf).`
                : `${count} ${contentLabelPlural} wurden zurückgezogen (Entwurf).`,
        deleteSuccess: (count) =>
            count === 1
                ? `1 ${contentLabel} wurde gelöscht.`
                : `${count} ${contentLabelPlural} wurden gelöscht.`,
        publishError: `${contentLabel} konnten nicht veröffentlicht werden.`,
        unpublishError: `${contentLabel} konnten nicht zurückgezogen werden.`,
        deleteError: `${contentLabel} konnten nicht gelöscht werden.`,
        noPublishable: `Keine Entwürfe in der Auswahl — nur Entwürfe können veröffentlicht werden.`,
        noUnpublishable: `Keine veröffentlichten Inhalte in der Auswahl.`,
    }
}
