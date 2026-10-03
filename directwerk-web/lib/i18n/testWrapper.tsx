import type {ReactNode} from 'react'

import {LocaleProvider} from './LocaleProvider'
import {testDictionary} from './testDictionary'

/** Wraps a client tree in the German `LocaleProvider` for unit tests. */
export function TestLocale({children}: {children: ReactNode}): React.JSX.Element {
    return (
        <LocaleProvider lang="de" dictionary={testDictionary}>
            {children}
        </LocaleProvider>
    )
}
