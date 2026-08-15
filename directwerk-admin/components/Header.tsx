'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useState, type ReactNode} from 'react'

import {Button} from '@directwerk/ui/components/button'
import AdminShell from '@directwerk/ui/components/layout/admin-shell'

import AdminSideNav from '@/components/AdminSideNav'
import {clearTokens, getAccessToken, subscribeToTokenStore} from '@/lib/auth/tokenStore'
import {clearTenantTokens} from '@/lib/auth/tenantTokenStore'

export default function Header({children}: {children: ReactNode}) {
    const pathname = usePathname()
    const router = useRouter()
    const [hasToken, setHasToken] = useState(false)

    useEffect(() => {
        setHasToken(getAccessToken() !== null)
        const unsubscribe = subscribeToTokenStore(() => {
            setHasToken(getAccessToken() !== null)
        })
        return unsubscribe
    }, [])

    function logout(): void {
        void fetch('/api/auth/logout', {method: 'POST', cache: 'no-store'})
        clearTokens()
        clearTenantTokens()
        router.replace('/login')
    }

    function goToLogin(): void {
        router.push('/login')
    }

    if (pathname === '/login') {
        return children
    }

    return (
        <AdminShell
            footer={
                hasToken ? (
                    <Button
                        className="w-full justify-start"
                        onClick={logout}
                        type="button"
                        variant="outline"
                    >
                        Log out
                    </Button>
                ) : (
                    <Button
                        className="w-full justify-start"
                        onClick={goToLogin}
                        type="button"
                        variant="outline"
                    >
                        Log in
                    </Button>
                )
            }
            brand={
                <Link className="block min-w-0" href="/">
                    <span className="block truncate text-sm font-semibold">Directwerk</span>
                    <span className="block text-xs text-muted-foreground">
                        Platform Admin
                    </span>
                </Link>
            }
            navigation={<AdminSideNav />}
        >
            {children}
        </AdminShell>
    )
}
