import type {BillingInterval} from '../types'

export interface FormatMoneyOptions {
    nullLabel?: string
}

function formatCurrencyCents(priceCents: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency,
    }).format(priceCents / 100)
}

export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: BillingInterval | string | null,
    options: FormatMoneyOptions = {},
): string {
    const nullLabel = options.nullLabel ?? 'Kein Preis'
    if (priceCents === null || priceCents === undefined) {
        return nullLabel
    }
    const code = currency && currency.length === 3 ? currency : 'EUR'
    let amount: string
    try {
        amount = formatCurrencyCents(priceCents, code)
    } catch {
        amount = formatCurrencyCents(priceCents, 'EUR')
    }
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
