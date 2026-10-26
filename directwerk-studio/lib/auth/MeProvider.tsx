'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {Me} from '@directwerk/api/types'

const MeContext = createContext<Me | null>(null)

export function MeProvider({
    me,
    children,
}: {
    me: Me | null
    children: ReactNode
}): React.JSX.Element {
    return <MeContext.Provider value={me}>{children}</MeContext.Provider>
}

export function useMe(): Me {
    const me = useContext(MeContext)
    if (me === null) {
        throw new Error('useMe must be used within MeProvider with a resolved account')
    }

    return me
}

export function useOptionalMe(): Me | null {
    return useContext(MeContext)
}
