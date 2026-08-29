/**
 * Extra packages for Next.js `experimental.optimizePackageImports`.
 * Next.js 16+ already optimizes lucide-react, date-fns, lodash-es, and others by default.
 */
export const extraOptimizePackageImports = [
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-link',
    '@directwerk/api/validation',
    '@directwerk/api/client',
] as const
