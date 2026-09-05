import type {BillingInterval} from '../types'

export interface FormatMoneyOptions {
    nullLabel?: string
}

function formatCurrencyCents(priceCents: number, currency: string): string {
    const code =
        typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)
            ? currency.toUpperCase()
            : 'EUR'
    try {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: code,
        }).format(priceCents / 100)
    } catch {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(priceCents / 100)
    }
}

export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: BillingInterval | string | null,
    options: FormatMoneyOptions = {},
): string {
    const nullLabel = options.nullLabel ?? 'Kein Preis'
    if (
        priceCents === null ||
        priceCents === undefined ||
        typeof priceCents !== 'number' ||
        !Number.isFinite(priceCents)
    ) {
        return nullLabel
    }
    const code = currency && currency.length === 3 ? currency : 'EUR'
    const amount = formatCurrencyCents(priceCents, code)
    if (interval === 'MONTH') {
        return `${amount} / Monat`
    }
    if (interval === 'YEAR') {
        return `${amount} / Jahr`
    }
    if (interval === 'ONE_TIME') {
        return `${amount} einmalig`
    }
    return amount
}
