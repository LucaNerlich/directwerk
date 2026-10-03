import CategoryEditor from '@/components/manage/CategoryEditor'

interface CategoryPageProps {
    params: Promise<{categoryId: string}>
}

export default async function CategoryPage({
    params,
}: CategoryPageProps): Promise<React.JSX.Element> {
    const {categoryId} = await params

    if (!/^\d+$/.test(categoryId)) {
        return <p>Ungültige Kategorie-ID.</p>
    }

    const parsed = Number.parseInt(categoryId, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return <p>Ungültige Kategorie-ID.</p>
    }

    return <CategoryEditor categoryId={parsed} />
}
