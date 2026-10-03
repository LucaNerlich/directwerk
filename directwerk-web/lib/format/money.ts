import type {BillingInterval} from '@directwerk/api/types'

import type {Locale} from '@/lib/i18n/config'
import type {Dictionary} from '@/lib/i18n/dictionary'

const NUMBER_LOCALES: Record<Locale, string> = {
    de: 'de-DE',
    en: 'en-GB',
}

function formatCurrencyCents(
    priceCents: number,
    currency: string | null | undefined,
    lang: Locale,
): string {
    const code =
        typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)
            ? currency.toUpperCase()
            : 'EUR'
    try {
        return new Intl.NumberFormat(NUMBER_LOCALES[lang], {
            style: 'currency',
            currency: code,
        }).format(priceCents / 100)
    } catch {
        return new Intl.NumberFormat(NUMBER_LOCALES[lang], {
            style: 'currency',
            currency: 'EUR',
        }).format(priceCents / 100)
    }
}

/** Localized price label including billing interval; `format.priceFollows` when no price is set. */
export function formatMoney(
    priceCents: number | null | undefined,
    currency: string | null | undefined,
    interval: BillingInterval | string | null | undefined,
    lang: Locale,
    format: Dictionary['format'],
): string {
    if (
        priceCents === null ||
        priceCents === undefined ||
        typeof priceCents !== 'number' ||
        !Number.isFinite(priceCents)
    ) {
        return format.priceFollows
    }
    const amount = formatCurrencyCents(priceCents, currency, lang)
    if (interval === 'MONTH') {
        return `${amount}${format.perMonth}`
    }
    if (interval === 'YEAR') {
        return `${amount}${format.perYear}`
    }
    if (interval === 'ONE_TIME') {
        return `${amount}${format.oneTime}`
    }
    return amount
}
