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
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [logoutError, setLogoutError] = useState(false)

    useEffect(() => {
        setHasToken(getAccessToken() !== null)
        const unsubscribe = subscribeToTokenStore(() => {
            setHasToken(getAccessToken() !== null)
        })
        return unsubscribe
    }, [])

    // Only clear local state and navigate once the server has actually cleared the
    // httpOnly refresh cookies — otherwise a failed request silently resurrects the
    // session on the next visit.
    async function logout(): Promise<void> {
        setIsLoggingOut(true)
        setLogoutError(false)
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                cache: 'no-store',
            })
            if (!response.ok) {
                setLogoutError(true)
                return
            }
            clearTokens()
            clearTenantTokens()
            router.replace('/login')
        } catch {
            setLogoutError(true)
        } finally {
            setIsLoggingOut(false)
        }
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
                <>
                {hasToken ? (
                    <div className="space-y-2">
                        {logoutError ? (
                            <p className="text-xs text-destructive" role="alert">
                                Log out failed. Please try again.
                            </p>
                        ) : null}
                        <Button
                            className="w-full justify-start"
                            disabled={isLoggingOut}
                            onClick={() => {
                                void logout()
                            }}
                            type="button"
                            variant={logoutError ? 'destructive' : 'outline'}
                        >
                            {isLoggingOut ? 'Logging out…' : logoutError ? 'Retry log out' : 'Log out'}
                        </Button>
                    </div>
                ) : (
                    <Button
                        className="w-full justify-start"
                        onClick={goToLogin}
                        type="button"
                        variant="outline"
                    >
                        Log in
                    </Button>
                )}
                <nav aria-label="Legal" className="flex gap-4 px-1 pt-1 text-xs text-muted-foreground">
                    <Link className="hover:text-foreground hover:underline" href="/imprint">
                        Imprint
                    </Link>
                    <Link className="hover:text-foreground hover:underline" href="/privacy">
                        Privacy
                    </Link>
                </nav>
                </>
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
