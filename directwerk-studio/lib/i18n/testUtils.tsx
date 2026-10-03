import {render, type RenderOptions, type RenderResult} from '@testing-library/react'
import type {ReactElement, ReactNode} from 'react'

import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import type {Locale} from '@/lib/i18n/config'
import type {Dictionary} from '@/lib/i18n/dictionary'

import deDictionary from '../../dictionaries/de.json'
import enDictionary from '../../dictionaries/en.json'

const dictionaries: Record<Locale, Dictionary> = {
    de: deDictionary,
    en: enDictionary,
}

export function renderWithLocale(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & {lang?: Locale},
): RenderResult {
    const lang = options?.lang ?? 'de'
    const {lang: _lang, ...renderOptions} = options ?? {}

    function Wrapper({children}: {children: ReactNode}): React.JSX.Element {
        return (
            <LocaleProvider dictionary={dictionaries[lang]} lang={lang}>
                {children}
            </LocaleProvider>
        )
    }

    return render(ui, {...renderOptions, wrapper: Wrapper})
}

export function withLocale(ui: ReactElement, lang: Locale = 'de'): ReactElement {
    return (
        <LocaleProvider dictionary={dictionaries[lang]} lang={lang}>
            {ui}
        </LocaleProvider>
    )
}
