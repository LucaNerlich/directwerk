import AuthCard from '@publish/ui/components/auth-card'

import LoginForm from '@/app/login/LoginForm'

export default function LoginPage() {
    return (
        <AuthCard
            description="Sign in with a platform administrator account."
            title="Directwerk platform admin"
        >
            <LoginForm />
        </AuthCard>
    )
}
