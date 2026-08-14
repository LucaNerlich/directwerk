'use client'

import {createContext, useContext, type ReactNode} from 'react'

import type {Me} from '@/lib/api/types'

const MeContext = createContext<Me | null>(null)

export function MeProvider({
    me,
    children,
}: {
    me: Me
    children: ReactNode
}): React.JSX.Element {
    return <MeContext.Provider value={me}>{children}</MeContext.Provider>
}

export function useMe(): Me {
    const me = useContext(MeContext)
    if (me === null) {
        throw new Error('useMe must be used within MeProvider')
    }

    return me
}

export function useOptionalMe(): Me | null {
    return useContext(MeContext)
}
