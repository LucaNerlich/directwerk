import AuthCard from '@directwerk/ui/components/auth-card'

import LoginForm from '@/app/login/LoginForm'

export default function LoginPage() {
    return (
        <AuthCard
            description="Sign in with a platform administrator account."
            footer="Platform access only. Tenant members sign in through directwerk-studio."
            title="Directwerk platform admin"
        >
            <LoginForm />
        </AuthCard>
    )
}
