import {redirect} from 'next/navigation'

export default function LegacySelectTenantPage(): never {
    redirect('/login')
}
