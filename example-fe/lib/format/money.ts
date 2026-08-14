export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: string | null,
): string {
    if (priceCents === null || priceCents === undefined) {
        return 'Price coming soon'
    }
    const code = currency && currency.length === 3 ? currency : 'EUR'
    const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
    }).format(priceCents / 100)
    if (interval === 'MONTH') {
        return `${amount} / month`
    }
    if (interval === 'YEAR') {
        return `${amount} / year`
    }
    if (interval === 'ONE_TIME') {
        return `${amount} one-time`
    }
    return amount
}
