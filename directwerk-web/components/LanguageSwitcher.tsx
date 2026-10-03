'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {LOCALE_COOKIE, type Locale, locales} from '@/lib/i18n/config'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {swapLocalePath} from '@/lib/i18n/paths'

function persistLocale(lang: Locale): void {
    document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
}

export default function LanguageSwitcher(): React.JSX.Element {
    const pathname = usePathname()
    const lang = useLocale()
    const dictionary = useDictionary()

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
