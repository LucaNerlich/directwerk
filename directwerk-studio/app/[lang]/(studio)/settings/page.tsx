import {redirect} from 'next/navigation'

export default async function SettingsIndexPage({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<never> {
    const {lang} = await params
    redirect(`/${lang}/settings/branding`)
}
