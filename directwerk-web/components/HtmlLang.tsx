'use client'

import {useEffect} from 'react'

import type {Locale} from '@/lib/i18n/config'

/** Keeps `<html lang>` in sync with the active `[lang]` segment. */
export default function HtmlLang({lang}: {lang: Locale}): null {
    useEffect(() => {
        document.documentElement.lang = lang
    }, [lang])
    return null
}
