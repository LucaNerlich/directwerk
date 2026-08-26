'use client'

import {useCallback, useEffect, useState, type FormEvent} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import {
    deleteTenantData,
    getTenantData,
    postTenantData,
    putTenantData,
} from '@/lib/api/tenantClient'
import {AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@directwerk/api/constants'
import {
    clearTenantTokens,
    getTenantSessionHost,
} from '@/lib/auth/tenantTokenStore'

interface TenantProductsPanelProps {
    sessionKey: number
}

interface SubscriptionProduct {
    id: number
    slug: string
    title: string
    offeringType: 'LEVEL' | 'PACKAGE'
    sortOrder: number
    active: boolean
}

interface ProductAccessRule {
    id: number
    productId: number
    scopeType: string
    scopeId: number | null
    effect: string
}

interface SubscriptionGrant {
    id: number
    email: string
    productId: number
    productSlug: string
    productTitle: string
    status: string
}

function isProduct(value: unknown): value is SubscriptionProduct {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const product = value as Record<string, unknown>
    return (
        typeof product.id === 'number' &&
        typeof product.slug === 'string' &&
        typeof product.title === 'string' &&
        (product.offeringType === 'LEVEL' || product.offeringType === 'PACKAGE') &&
        typeof product.sortOrder === 'number' &&
        typeof product.active === 'boolean'
    )
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
    const [newOfferingType, setNewOfferingType] = useState<'LEVEL' | 'PACKAGE'>(
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

        getTenantData<SubscriptionProduct[]>('tenant/products')
            .then((result) => {
                if (!Array.isArray(result) || !result.every(isProduct)) {
                    setError('Could not load products.')
                    setProducts([])
                    return
                }
                setProducts(result)
                const activeProducts = result.filter((product) => product.active)
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
                <CardHeader><CardTitle id="tenant-products-heading">Products & grants</CardTitle></CardHeader>
                <CardContent><EmptyState description="Sign in to a tenant session above to manage products." title="Tenant session required" /></CardContent>
            </Card>
        )
    }

    return (
        <Card aria-labelledby="tenant-products-heading" role="region">
            <CardHeader><CardTitle id="tenant-products-heading">Products & grants</CardTitle></CardHeader>
            <CardContent className="space-y-6">
            {error ? (
                <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            ) : null}
            {status ? (
                <p aria-live="polite" role="status">
                    {status}
                </p>
            ) : null}
            {isLoading ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading products…</p> : null}

            <h3 className="text-lg font-semibold">Create product</h3>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleCreate(event)}>
                <p>
                    <Label htmlFor="admin-product-slug">Slug</Label>
                    <br />
                    <Input
                        id="admin-product-slug"
                        onChange={(event) => setNewSlug(event.target.value)}
                        required
                        value={newSlug}
                    />
                </p>
                <p>
                    <Label htmlFor="admin-product-title">Title</Label>
                    <br />
                    <Input
                        id="admin-product-title"
                        onChange={(event) => setNewTitle(event.target.value)}
                        required
                        value={newTitle}
                    />
                </p>
                <p>
                    <Label htmlFor="admin-product-sort">Sort order</Label>
                    <br />
                    <Input
                        id="admin-product-sort"
                        onChange={(event) => setNewSortOrder(event.target.value)}
                        type="number"
                        value={newSortOrder}
                    />
                </p>
                <p>
                    <Label htmlFor="admin-product-type">Offering type</Label>
                    <br />
                    <select className="native-select"
                        id="admin-product-type"
                        onChange={(event) =>
                            setNewOfferingType(
                                event.target.value as 'LEVEL' | 'PACKAGE'
                            )
                        }
                        value={newOfferingType}
                    >
                        <option value="LEVEL">LEVEL</option>
                        <option value="PACKAGE">PACKAGE</option>
                    </select>
                </p>
                <Button className="w-fit sm:col-span-2" type="submit">Create</Button>
            </form>

            <h3>Products</h3>
            {products.length === 0 ? (
                <EmptyState title="No products" />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">Title</TableHead>
                            <TableHead scope="col">Type</TableHead>
                            <TableHead scope="col">Sort</TableHead>
                            <TableHead scope="col">Active</TableHead>
                            <TableHead scope="col">Rules</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell>
                                    {product.title}
                                    <br />
                                    <small>{product.slug}</small>
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {selectedProductId !== null ? (
                <>
                    <h3>Rules for product {selectedProductId}</h3>
                    <ul>
                        {rules.map((rule) => (
                            <li key={rule.id}>
                                {rule.scopeType}
                                {rule.scopeId !== null
                                    ? ` #${rule.scopeId}`
                                    : ''}{' '}
                                ({rule.effect})
                            </li>
                        ))}
                    </ul>
                    <p>
                        <Label htmlFor="admin-rule-scope">Replace with</Label>{' '}
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
                        </select>{' '}
                        {ruleScopeType !== 'ALL_PODCASTS' ? (
                            <Input
                                aria-label="Scope ID"
                                onChange={(event) =>
                                    setRuleScopeId(event.target.value)
                                }
                                placeholder="scope id"
                                type="number"
                                value={ruleScopeId}
                            />
                        ) : null}{' '}
                        <Button
                            onClick={() => void handleSaveRules()}
                            type="button"
                        >
                            Save rules
                        </Button>
                    </p>
                </>
            ) : null}

            <h3>Grant subscription</h3>
            <form onSubmit={(event) => void handleGrant(event)}>
                <p>
                    <Label htmlFor="admin-grant-email">Email</Label>
                    <br />
                    <Input
                        id="admin-grant-email"
                        onChange={(event) => setGrantEmail(event.target.value)}
                        required
                        type="email"
                        value={grantEmail}
                    />
                </p>
                <p>
                    <Label htmlFor="admin-grant-product">Product</Label>
                    <br />
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
                </p>
                <Button type="submit">Grant</Button>
            </form>

            {grants.length > 0 ? (
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
            ) : null}
            </CardContent>
        </Card>
    )
}
