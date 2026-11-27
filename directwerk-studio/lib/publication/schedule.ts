/** Message for a schedule instant, or null when it is a valid future time (#1055). */
export function scheduleValidationMessage(iso: string | null): string | null {
    if (iso === null) {
        return 'Bitte einen gültigen Zeitpunkt wählen.'
    }
    if (new Date(iso).getTime() <= Date.now()) {
        return 'Bitte einen Zeitpunkt in der Zukunft wählen.'
    }
    return null
}
