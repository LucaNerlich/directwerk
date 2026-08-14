import Link from 'next/link'

import {buttonVariants} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

export default function CheckoutCancelPage(): React.JSX.Element {
    return (
        <div className="page-container space-y-6">
            <PageHeader
                title="Checkout abgebrochen"
                description="Es wurde nichts berechnet. Du kannst später ein anderes Produkt wählen."
            />
            <div className="flex flex-wrap gap-3">
                <Link className={buttonVariants()} href="/pricing">
                    Zurück zu den Preisen
                </Link>
                <Link className={buttonVariants({variant: 'outline'})} href="/account">
                    Zum Konto
                </Link>
            </div>
        </div>
    )
}
