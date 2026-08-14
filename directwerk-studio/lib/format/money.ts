import type {BillingInterval} from '@/lib/api/types'

export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: BillingInterval | string | null,
): string {
    if (priceCents === null || priceCents === undefined) {
        return 'Kein Preis'
    }
    const code = currency && currency.length === 3 ? currency : 'EUR'
    const amount = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: code,
    }).format(priceCents / 100)
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
