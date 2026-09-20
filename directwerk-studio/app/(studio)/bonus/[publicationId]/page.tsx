import DigitalPublicationEditor from '@/components/media/DigitalPublicationEditor'

interface BonusPublicationPageProps {
    params: Promise<{publicationId: string}>
}

export default async function BonusPublicationPage({
    params,
}: BonusPublicationPageProps): Promise<React.JSX.Element> {
    const {publicationId} = await params
    const id = Number.parseInt(publicationId, 10)
    return <DigitalPublicationEditor publicationId={Number.isSafeInteger(id) ? id : undefined} />
}
