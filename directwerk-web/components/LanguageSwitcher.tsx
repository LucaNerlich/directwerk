'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {buttonVariants} from '@directwerk/ui/components/button'
import {writeLocaleCookie} from '@directwerk/ui/lib/i18n'
import {cn} from '@directwerk/ui/lib/utils'

import {LOCALE_COOKIE, type Locale, locales} from '@/lib/i18n/config'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {swapLocalePath} from '@/lib/i18n/paths'

function persistLocale(lang: Locale): void {
    writeLocaleCookie(LOCALE_COOKIE, lang)
}

export default function LanguageSwitcher({
    layout = 'compact',
}: {
    /** Compact inline DE/EN for the desktop header; full-width row for the mobile sheet. */
    layout?: 'compact' | 'row'
}): React.JSX.Element {
    const pathname = usePathname()
    const lang = useLocale()
    const dictionary = useDictionary()

    if (layout === 'row') {
        return (
            <div
                className="flex min-h-11 w-full flex-col gap-1"
                role="navigation"
                aria-label={dictionary.nav.language}
            >
                <span className="px-2.5 text-xs font-medium text-muted-foreground">
                    {dictionary.nav.language}
                </span>
                <div className="grid grid-cols-2 gap-1">
                    {locales.map((locale) => {
                        const label =
                            locale === 'de'
                                ? dictionary.nav.languageDe
                                : dictionary.nav.languageEn
                        const href = swapLocalePath(pathname, locale)
                        const isActive = locale === lang
                        return (
                            <Link
                                key={locale}
                                href={href}
                                hrefLang={locale}
                                className={cn(
                                    buttonVariants({
                                        variant: isActive ? 'secondary' : 'ghost',
                                        className: 'min-h-11 justify-center',
                                    }),
                                )}
                                aria-current={isActive ? 'true' : undefined}
                                onClick={() => {
                                    persistLocale(locale)
                                }}
                            >
                                {label}
                            </Link>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div
            className="flex items-center gap-1 text-sm"
            role="navigation"
            aria-label={dictionary.nav.language}
        >
            {locales.map((locale) => {
                const label =
                    locale === 'de' ? dictionary.nav.languageDe : dictionary.nav.languageEn
                const href = swapLocalePath(pathname, locale)
                const isActive = locale === lang
                return (
                    <Link
                        key={locale}
                        href={href}
                        hrefLang={locale}
                        className={
                            isActive
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground underline-offset-4 hover:underline'
                        }
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => {
                            persistLocale(locale)
                        }}
                    >
                        {label}
                    </Link>
                )
            }).flatMap((node, index) =>
                index === 0
                    ? [node]
                    : [
                          <span key={`sep-${index}`} className="text-muted-foreground" aria-hidden>
                              /
                          </span>,
                          node,
                      ],
            )}
        </div>
    )
}
