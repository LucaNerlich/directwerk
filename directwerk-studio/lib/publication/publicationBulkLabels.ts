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
        publishPartial: (successCount, failureCount) =>
            `${successCount} veröffentlicht, ${failureCount} fehlgeschlagen.`,
        unpublishPartial: (successCount, failureCount) =>
            `${successCount} zurückgezogen, ${failureCount} fehlgeschlagen.`,
        publishError: `${contentLabel} konnte nicht veröffentlicht werden.`,
        unpublishError: `${contentLabel} konnte nicht zurückgezogen werden.`,
        noPublishable: `Keine Entwürfe in der Auswahl — nur Entwürfe können veröffentlicht werden.`,
        noUnpublishable: `Keine veröffentlichten Inhalte in der Auswahl.`,
    }
}
