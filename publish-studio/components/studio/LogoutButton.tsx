'use client'

import {useRouter} from 'next/navigation'

import {Button} from '@publish/ui/components/button'

import {clearTokens} from '@/lib/auth/tokenStore'

export default function LogoutButton() {
    const router = useRouter()

    return (
        <Button
            type="button"
            className="w-full justify-start"
            variant="outline"
            onClick={() => {
                clearTokens()
                router.push('/login')
            }}
        >
            Abmelden
        </Button>
    )
}
