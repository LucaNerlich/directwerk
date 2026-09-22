import DigitalPublicationEditor from '@/components/media/DigitalPublicationEditor'

interface BonusPublicationPageProps {
    params: Promise<{publicationId: string}>
}

export default async function BonusPublicationPage({
    params,
}: BonusPublicationPageProps): Promise<React.JSX.Element> {
    const {publicationId} = await params
    if (!/^\d+$/.test(publicationId)) {
        return <p>Ungültige Bonusdatei.</p>
    }
    const id = Number(publicationId)
    if (!Number.isSafeInteger(id) || id < 1) {
        return <p>Ungültige Bonusdatei.</p>
    }
    return <DigitalPublicationEditor publicationId={id} />
}
