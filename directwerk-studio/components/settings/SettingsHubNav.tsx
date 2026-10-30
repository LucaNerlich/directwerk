'use client'

import SettingsTabs from '@/components/settings/SettingsTabs'

export default function SettingsHubNav({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <div className="flex flex-col gap-6">
            <SettingsTabs />
            {children}
        </div>
    )
}
