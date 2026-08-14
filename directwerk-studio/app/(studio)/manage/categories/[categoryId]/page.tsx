import CategoryEditor from '@/components/manage/CategoryEditor'

interface CategoryPageProps {
    params: Promise<{categoryId: string}>
}

/**
 * Renders the category editor for a valid category ID.
 *
 * @param params - Route parameters containing the category ID.
 * @returns The category editor for a valid ID, or an invalid-ID message otherwise.
 */
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
