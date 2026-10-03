'use client'

import {useRouter} from 'next/navigation'

import {Button} from '@directwerk/ui/components/button'

import {LOCALE_COOKIE, locales, type Locale} from '@/lib/i18n/config'
import {swapLangInPath} from '@/lib/i18n/paths'

import {useDictionary, useLocale} from './LocaleProvider'
import {useSwapLangPath} from './useLocalizedPath'

function persistLocale(lang: Locale): void {
    document.cookie = `${LOCALE_COOKIE}=${lang};path=/;max-age=31536000;samesite=lax`
}

export default function LanguageSwitcher(): React.JSX.Element {
    const lang = useLocale()
    const dict = useDictionary()
    const router = useRouter()
    const pathFor = useSwapLangPath()

    return (
        <div
            aria-label={dict.shell.language}
            className="flex items-center gap-1"
            role="group"
        >
            {locales.map((locale) => {
                const active = locale === lang
                const label = locale === 'de' ? dict.shell.languageDe : dict.shell.languageEn
                return (
                    <Button
                        key={locale}
                        aria-current={active ? 'true' : undefined}
                        aria-pressed={active}
                        className="min-h-8 px-2 text-xs"
                        onClick={() => {
                            if (locale === lang) {
                                return
                            }
                            persistLocale(locale)
                            router.replace(pathFor(locale))
                        }}
                        size="sm"
                        type="button"
                        variant={active ? 'secondary' : 'ghost'}
                    >
                        {label}
                    </Button>
                )
            })}
        </div>
    )
}

/** Server-safe helper for building the alternate path (tests / SSR). */
export function alternatePath(pathname: string, nextLang: Locale): string {
    return swapLangInPath(pathname, nextLang)
}
