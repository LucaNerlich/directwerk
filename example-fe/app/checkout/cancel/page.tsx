import Link from 'next/link'

import {buttonVariants} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

export default function CheckoutCancelPage(): React.JSX.Element {
    return (
        <div className="page-container space-y-6">
            <PageHeader
                title="Checkout canceled"
                description="Nothing was charged. You can pick another product later."
            />
            <Link className={buttonVariants()} href="/pricing">
                Back to pricing
            </Link>
        </div>
    )
}
