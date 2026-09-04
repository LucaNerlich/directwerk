export type PriceParseResult =
    | {valid: true; priceCents: number | undefined}
    | {valid: false; message: string}

/**
 * Parses a German/English price input ("14,90", "14.90", "1.234,56") into
 * cents. Empty input means "no price" (valid, undefined). Negative or
 * unparseable input is invalid — callers must surface `message` instead of
 * silently dropping the value.
 */
export function parsePriceEurosToCents(raw: string): PriceParseResult {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
        return {valid: true, priceCents: undefined}
    }
    // German thousands ("1.234,56"): drop grouping dots when a comma is used
    // as the decimal separator. Otherwise a plain dot is the decimal point.
    const normalized = trimmed.includes(',')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        return {
            valid: false,
            message: 'Bitte einen gültigen Preis eingeben (z. B. 14,90).',
        }
    }
    const euros = Number.parseFloat(normalized)
    if (!Number.isFinite(euros) || euros < 0) {
        return {
            valid: false,
            message: 'Bitte einen gültigen Preis eingeben (z. B. 14,90).',
        }
    }
    return {valid: true, priceCents: Math.round(euros * 100)}
}
