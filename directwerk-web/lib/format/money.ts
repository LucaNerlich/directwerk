import {formatMoney as formatMoneyBase} from '@directwerk/api/format'

export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval?: string | null,
): string {
    return formatMoneyBase(priceCents, currency, interval, {nullLabel: 'Preis folgt'})
}
