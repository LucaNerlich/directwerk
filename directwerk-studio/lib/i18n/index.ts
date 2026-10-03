export {
    defaultLocale,
    isLocale,
    LOCALE_COOKIE,
    locales,
    type Locale,
} from './config'
export type {Dictionary} from './dictionary'
export {t} from './dictionary'
export {assertLocale, getDictionary} from './getDictionary'
export {matchLocale, preferredLocale} from './matchLocale'
export {
    localeFromPathname,
    localizedPath,
    pathHasLocalePrefix,
    stripLangPrefix,
    swapLangInPath,
} from './paths'
