'use client'

import type {ReactNode} from 'react'

import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'

/** Auth layout chrome: language switcher in the top-right corner. */
export default function AuthChrome({children}: {children: ReactNode}): React.JSX.Element {
    return (
        <div className="relative min-h-svh">
            <div className="absolute right-4 top-4 z-10">
                <LanguageSwitcher />
            </div>
            {children}
        </div>
    )
}
