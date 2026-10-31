import type {ReactNode} from 'react'

import {ThemeProvider} from '@/components/theme-provider'

import {LocaleProvider} from './LocaleProvider'
import {testDictionary} from './testDictionary'

/** Wraps a client tree in the German `LocaleProvider` for unit tests. */
export function TestLocale({children}: {children: ReactNode}): React.JSX.Element {
    return (
        <ThemeProvider defaultTheme="light">
            <LocaleProvider lang="de" dictionary={testDictionary}>
                {children}
            </LocaleProvider>
        </ThemeProvider>
    )
}
