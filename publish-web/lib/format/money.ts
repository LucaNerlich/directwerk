export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: string | null,
): string {
    if (priceCents === null || priceCents === undefined) {
        return 'Preis folgt'
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
