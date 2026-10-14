'use client'

import {useEffect, useState} from 'react'

import type {PublicProduct} from '@directwerk/api/types'

import {listPublicProducts} from '@/lib/api/client'

/**
 * Public products for unlock links (`findUnlockProduct`). Fails silently to
 * `[]` — callers fall back to plain `/pricing`.
 */
export function usePublicProducts(): PublicProduct[] {
    const [products, setProducts] = useState<PublicProduct[]>([])

    useEffect(() => {
        let active = true
        listPublicProducts()
            .then((loaded) => {
                if (active) {
                    setProducts(loaded)
                }
            })
            .catch(() => {
                if (active) {
                    setProducts([])
                }
            })
        return () => {
            active = false
        }
    }, [])

    return products
}
