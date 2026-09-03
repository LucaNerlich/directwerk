'use client'

import {useCallback, useEffect, useState, type FormEvent} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import {
    deleteTenantData,
    getTenantData,
    postTenantData,
    putTenantData,
} from '@/lib/api/tenantClient'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@directwerk/api/constants'
import type {
    OfferingType,
    ProductAccessRule,
    SubscriptionGrant,
    SubscriptionProduct,
} from '@directwerk/api/types'
import {listTenantProducts} from '@/lib/api/tenantProductsApi'
import {
    clearTenantTokens,
    getTenantSessionHost,
} from '@/lib/auth/tenantTokenStore'

interface TenantProductsPanelProps {
    sessionKey: number
}

export default function TenantProductsPanel({
    sessionKey,
}: TenantProductsPanelProps) {
    const [hasSession, setHasSession] = useState(false)
    const [products, setProducts] = useState<SubscriptionProduct[]>([])
    const [selectedProductId, setSelectedProductId] = useState<number | null>(
        null
    )
    const [rules, setRules] = useState<ProductAccessRule[]>([])
    const [grants, setGrants] = useState<SubscriptionGrant[]>([])
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const [newSlug, setNewSlug] = useState('')
    const [newTitle, setNewTitle] = useState('')
    const [newSortOrder, setNewSortOrder] = useState('0')
    const [newOfferingType, setNewOfferingType] = useState<OfferingType>(
        'LEVEL'
    )
    const [grantEmail, setGrantEmail] = useState('')
    const [grantProductId, setGrantProductId] = useState('')
    const [ruleScopeType, setRuleScopeType] = useState('ALL_PODCASTS')
    const [ruleScopeId, setRuleScopeId] = useState('')

    const loadProducts = useCallback(() => {
        if (!getTenantSessionHost()) {
            setHasSession(false)
            setProducts([])
            return
        }

        setHasSession(true)
        setIsLoading(true)
        setError(null)

        listTenantProducts()
            .then((products) => {
                setProducts(products)
                const activeProducts = products.filter((product) => product.active)
                const firstActive = activeProducts[0]
                setGrantProductId((current) => {
                    if (
                        current !== '' &&
                        activeProducts.some(
                            (product) => String(product.id) === current
                        )
                    ) {
                        return current
                    }
                    return firstActive ? String(firstActive.id) : ''
                })
            })
            .catch((requestError: unknown) => {
                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    clearTenantTokens()
                    setHasSession(false)
                    setError('Tenant session expired. Sign in again.')
                    return
                }
                setError('Could not load products (is SUBSCRIPTION enabled?).')
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [])

    useEffect(() => {
        loadProducts()
    }, [loadProducts, sessionKey])

    async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setError(null)
        setStatus(null)

        const sortOrder = Number.parseInt(newSortOrder, 10)
        try {
            await postTenantData<SubscriptionProduct>('tenant/products', {
                slug: newSlug.trim(),
                title: newTitle.trim(),
                sortOrder: Number.isSafeInteger(sortOrder) ? sortOrder : 0,
                offeringType: newOfferingType,
            })
            setNewSlug('')
            setNewTitle('')
            setStatus('Product created.')
            loadProducts()
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === CONFLICT
            ) {
                setError('Product slug already exists.')
                return
            }
            setError('Could not create product.')
        }
    }

    async function handleDeactivate(productId: number): Promise<void> {
        const confirmed = window.confirm(
            'Deactivate this product? Existing subscribers keep access until their grants are revoked.',
        )
        if (!confirmed) {
            return
        }
        setError(null)
        setStatus(null)
        try {
            await deleteTenantData<SubscriptionProduct>(`tenant/products/${productId}`)
            setStatus('Product deactivated.')
            loadProducts()
        } catch {
            setError('Could not deactivate product.')
        }
    }

    async function loadRules(productId: number): Promise<void> {
        setSelectedProductId(productId)
        setError(null)
        try {
            const result = await getTenantData<ProductAccessRule[]>(
                `tenant/products/${productId}/rules`
            )
            if (!Array.isArray(result)) {
                setError('Could not load rules.')
                return
            }
            setRules(result)
        } catch {
            setError('Could not load rules.')
        }
    }

    async function handleSaveRules(): Promise<void> {
        if (selectedProductId === null) {
            return
        }

        const rulesPayload =
            ruleScopeType === 'ALL_PODCASTS'
                ? [{scopeType: 'ALL_PODCASTS', scopeId: null}]
                : [
                      {
                          scopeType: ruleScopeType,
                          scopeId: Number.parseInt(ruleScopeId, 10),
                      },
                  ]

        try {
            const saved = await putTenantData<ProductAccessRule[]>(
                `tenant/products/${selectedProductId}/rules`,
                {rules: rulesPayload}
            )
            setRules(Array.isArray(saved) ? saved : [])
            setStatus('Rules saved.')
        } catch {
            setError('Could not save rules (PACKAGE products only).')
        }
    }

    async function handleGrant(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setError(null)
        setStatus(null)

        const productId = Number.parseInt(grantProductId, 10)
        try {
            const grant = await postTenantData<SubscriptionGrant>(
                'tenant/subscriptions',
                {
                    email: grantEmail.trim(),
                    productId,
                }
            )
            setGrants((current) => [grant, ...current])
            setGrantEmail('')
            setStatus(`Granted ${grant.email} → ${grant.productTitle}`)
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                setError('Grant failed. User must be an active tenant member.')
                return
            }
            setError('Grant failed.')
        }
    }

    async function handleRevoke(subscriptionId: number): Promise<void> {
        const confirmed = window.confirm(
            `Revoke subscription ${subscriptionId}? The subscriber immediately loses access.`,
        )
        if (!confirmed) {
            return
        }
        try {
            const revoked = await deleteTenantData<SubscriptionGrant>(
                `tenant/subscriptions/${subscriptionId}`
            )
            setGrants((current) =>
                current.map((grant) =>
                    grant.id === subscriptionId ? revoked : grant
                )
            )
            setStatus(`Revoked subscription ${subscriptionId}.`)
        } catch {
            setError('Revoke failed.')
        }
    }

    if (!hasSession) {
        return (
            <Card aria-labelledby="tenant-products-heading" role="region">
                <CardHeader>
                    <CardTitle id="tenant-products-heading">Products & grants</CardTitle>
                    <CardDescription>
                        Tenant subscription products, access rules, and manual
                        grants. Requires a tenant session because the platform
                        token cannot call tenant APIs.
                    </CardDescription>
                </CardHeader>
                <CardContent><EmptyState description="Sign in to a tenant session above to manage products." title="Tenant session required" /></CardContent>
            </Card>
        )
    }

    return (
        <Card aria-labelledby="tenant-products-heading" role="region">
            <CardHeader>
                <CardTitle id="tenant-products-heading">Products & grants</CardTitle>
                <CardDescription>
                    Tenant subscription products, PACKAGE access rules, and
                    manual subscription grants.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {error ? (
                <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            ) : null}
            {status ? (
                <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
                    {status}
                </p>
            ) : null}
            {isLoading ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading products…</p> : null}

            <SectionHeader
                description="LEVEL products gate by tier; PACKAGE products gate by access rules below."
                title="Create product"
            />
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleCreate(event)}>
                <div className="space-y-2">
                    <Label htmlFor="admin-product-slug">Slug</Label>
                    <Input
                        id="admin-product-slug"
                        onChange={(event) => setNewSlug(event.target.value)}
                        required
                        value={newSlug}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-product-title">Title</Label>
                    <Input
                        id="admin-product-title"
                        onChange={(event) => setNewTitle(event.target.value)}
                        required
                        value={newTitle}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-product-sort">Sort order</Label>
                    <Input
                        id="admin-product-sort"
                        onChange={(event) => setNewSortOrder(event.target.value)}
                        type="number"
                        value={newSortOrder}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-product-type">Offering type</Label>
                    <select className="native-select"
                        id="admin-product-type"
                        onChange={(event) =>
                            setNewOfferingType(
                                event.target.value as OfferingType
                            )
                        }
                        value={newOfferingType}
                    >
                        <option value="LEVEL">LEVEL</option>
                        <option value="PACKAGE">PACKAGE</option>
                    </select>
                </div>
                <Button className="w-fit sm:col-span-2" type="submit">Create</Button>
            </form>

            <SectionHeader
                description={products.length > 0 ? `${products.filter((product) => product.active).length} of ${products.length} active.` : undefined}
                title="Products"
            />
            {products.length === 0 ? (
                <EmptyState
                    description="Create the first product to sell or grant access."
                    title="No products"
                />
            ) : (
                <ResponsiveTable label="Subscription products">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">Title</TableHead>
                            <TableHead scope="col">Type</TableHead>
                            <TableHead scope="col">Sort</TableHead>
                            <TableHead scope="col">Active</TableHead>
                            <TableHead scope="col">Rules</TableHead>
                            <TableHead scope="col">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell>
                                    <span className="font-medium">{product.title}</span>
                                    <span className="block text-xs text-muted-foreground">{product.slug}</span>
                                </TableCell>
                                <TableCell>{product.offeringType}</TableCell>
                                <TableCell>{product.sortOrder}</TableCell>
                                <TableCell><Badge variant={product.active ? 'default' : 'outline'}>{product.active ? 'Yes' : 'No'}</Badge></TableCell>
                                <TableCell>
                                    {product.offeringType === 'PACKAGE' ? (
                                        <Button
                                            onClick={() =>
                                                void loadRules(product.id)
                                            }
                                            type="button"
                                            variant="outline"
                                        >
                                            Edit rules
                                        </Button>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {product.active ? (
                                        <Button
                                            onClick={() => {
                                                void handleDeactivate(product.id)
                                            }}
                                            type="button"
                                            variant="outline"
                                        >
                                            Deactivate
                                        </Button>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </ResponsiveTable>
            )}

            {selectedProductId !== null ? (
                <div className="space-y-3">
                    <SectionHeader
                        description="PACKAGE products only. Saving replaces all rules for this product."
                        title={`Rules for product ${selectedProductId}`}
                    />
                    {rules.length > 0 ? (
                        <ListPanel aria-label={`Access rules for product ${selectedProductId}`}>
                            {rules.map((rule) => (
                                <ListPanelRow key={rule.id}>
                                    <span className="text-sm">
                                        <span className="font-medium">{rule.scopeType}</span>
                                        {rule.scopeId !== null
                                            ? ` #${rule.scopeId}`
                                            : ''}
                                    </span>
                                    <Badge variant="outline">{rule.effect}</Badge>
                                </ListPanelRow>
                            ))}
                        </ListPanel>
                    ) : (
                        <p className="text-sm text-muted-foreground">No rules yet.</p>
                    )}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="admin-rule-scope">Replace with</Label>
                            <select className="native-select"
                                id="admin-rule-scope"
                                onChange={(event) =>
                                    setRuleScopeType(event.target.value)
                                }
                                value={ruleScopeType}
                            >
                                <option value="ALL_PODCASTS">ALL_PODCASTS</option>
                                <option value="PODCAST_SERIES">
                                    PODCAST_SERIES
                                </option>
                                <option value="FORMAT">FORMAT</option>
                                <option value="CATEGORY">CATEGORY</option>
                            </select>
                        </div>
                        {ruleScopeType !== 'ALL_PODCASTS' ? (
                            <div className="space-y-2">
                                <Label htmlFor="admin-rule-scope-id">Scope ID</Label>
                                <Input
                                    id="admin-rule-scope-id"
                                    onChange={(event) =>
                                        setRuleScopeId(event.target.value)
                                    }
                                    placeholder="scope id"
                                    type="number"
                                    value={ruleScopeId}
                                />
                            </div>
                        ) : null}
                        <Button
                            onClick={() => void handleSaveRules()}
                            type="button"
                        >
                            Save rules
                        </Button>
                    </div>
                </div>
            ) : null}

            <SectionHeader
                description="Manual grants require an active tenant member. Stripe, Patreon, and Steady grant automatically via webhooks."
                title="Grant subscription"
            />
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleGrant(event)}>
                <div className="space-y-2">
                    <Label htmlFor="admin-grant-email">Email</Label>
                    <Input
                        id="admin-grant-email"
                        onChange={(event) => setGrantEmail(event.target.value)}
                        required
                        type="email"
                        value={grantEmail}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-grant-product">Product</Label>
                    <select className="native-select"
                        id="admin-grant-product"
                        onChange={(event) =>
                            setGrantProductId(event.target.value)
                        }
                        required
                        value={grantProductId}
                    >
                        {products
                            .filter((product) => product.active)
                            .map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.title}
                                </option>
                            ))}
                    </select>
                </div>
                <Button className="w-fit sm:col-span-2" type="submit">Grant</Button>
            </form>

            {grants.length > 0 ? (
                <ResponsiveTable label="Manual subscription grants">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">Email</TableHead>
                            <TableHead scope="col">Product</TableHead>
                            <TableHead scope="col">Status</TableHead>
                            <TableHead scope="col">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {grants.map((grant) => (
                            <TableRow key={grant.id}>
                                <TableCell>{grant.email}</TableCell>
                                <TableCell>{grant.productTitle}</TableCell>
                                <TableCell><Badge variant="outline">{grant.status}</Badge></TableCell>
                                <TableCell>
                                    {grant.status === 'ACTIVE' ? (
                                        <Button
                                            onClick={() =>
                                                void handleRevoke(grant.id)
                                            }
                                            type="button"
                                            variant="destructive"
                                        >
                                            Revoke
                                        </Button>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </ResponsiveTable>
            ) : null}
            </CardContent>
        </Card>
    )
}
