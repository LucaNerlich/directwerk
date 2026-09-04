import path from 'node:path'
import {readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import { defineConfig } from 'vitepress'
import { diagramPlugin } from 'vitepress-plugin-mermaid-diagram'
import { openApiDocs } from 'vitepress-openapi-docs/vitepress'

const docsPackageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

function findPnpmPackageRoot(packageName: string): string {
  const pnpmDirs = [
    path.join(docsPackageRoot, 'node_modules/.pnpm'),
    path.resolve(docsPackageRoot, '../node_modules/.pnpm'),
  ]

  for (const pnpmDir of pnpmDirs) {
    try {
      const entry = readdirSync(pnpmDir).find((name) =>
        name.startsWith(`${packageName}@`),
      )
      if (entry) {
        return path.join(pnpmDir, entry, 'node_modules', packageName)
      }
    } catch {
      continue
    }
  }

  throw new Error(
    `${packageName} is missing. Run pnpm install from the monorepo root.`,
  )
}

const vueApiPlaygroundRoot = findPnpmPackageRoot('vue-api-playground')
const vueApiPlaygroundStyles = path.join(
  vueApiPlaygroundRoot,
  'dist/vue-api-playground.css',
)

const sidebarGuide = [
  {
    text: 'Guide',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Apps', link: '/guide/apps' },
      { text: 'Quickstart', link: '/guide/quickstart' },
    ],
  },
]

const sidebarInstall = [
  {
    text: 'Install',
    items: [
      { text: 'Local development', link: '/install/local-development' },
      { text: 'Docker & Coolify', link: '/install/docker-and-coolify' },
      { text: 'Environment variables', link: '/install/environment-variables' },
    ],
  },
]

const sidebarOperators = [
  {
    text: 'Operators',
    items: [
      {
        text: 'Subscriptions & entitlements',
        link: '/operators/subscriptions-and-entitlements',
      },
      { text: 'Media upload', link: '/operators/media-upload' },
      { text: 'Email & background jobs', link: '/operators/email-and-jobs' },
    ],
  },
]

const sidebarArchitecture = [
  {
    text: 'Architecture',
    items: [
      { text: 'Multi-tenancy', link: '/architecture/multi-tenancy' },
      { text: 'Asset storage', link: '/architecture/asset-storage' },
      { text: 'RSS feeds', link: '/architecture/rss-feeds' },
      { text: 'Stripe billing', link: '/architecture/billing-stripe' },
    ],
  },
]

const sidebarApi = [
  {
    text: 'API',
    items: [
      { text: 'Integration guide', link: '/api/integration' },
      { text: 'Reference (OpenAPI)', link: '/api/reference/' },
    ],
  },
]

export default defineConfig({
  title: 'Directwerk Docs',
  description:
    'Documentation for Directwerk — API-first podcast and publication platform.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: process.env.VITEPRESS_LAST_UPDATED !== '0',
  ignoreDeadLinks: true,
  markdown: {
    lineNumbers: true,
    config(md) {
      md.use(diagramPlugin)
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#3a3226' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Directwerk Docs' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Documentation for Directwerk — API-first podcast and publication platform.',
      },
    ],
  ],
  vite: {
    resolve: {
      alias: [
        {
          find: 'vue-api-playground/styles',
          replacement: vueApiPlaygroundStyles,
        },
        { find: 'vue-api-playground', replacement: vueApiPlaygroundRoot },
      ],
    },
    ssr: {
      noExternal: ['vue-api-playground', 'vitepress-openapi-docs'],
    },
    optimizeDeps: {
      include: ['vue-api-playground'],
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'openapi',
                test: /node_modules\/(vitepress-openapi-docs|vue-api-playground|@scalar)/,
                priority: 20,
              },
              {
                name: 'mermaid',
                test: /node_modules\/(mermaid|vitepress-plugin-mermaid-diagram)/,
                priority: 15,
              },
            ],
          },
        },
      },
    },
  },
  themeConfig: {
    siteTitle: 'Directwerk Docs',
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Install', link: '/install/local-development', activeMatch: '/install/' },
      { text: 'Operators', link: '/operators/subscriptions-and-entitlements', activeMatch: '/operators/' },
      {
        text: 'Architecture',
        link: '/architecture/multi-tenancy',
        activeMatch: '/architecture/',
      },
      { text: 'API', link: '/api/integration', activeMatch: '/api/' },
      { component: 'DocsNavCta' },
    ],
    sidebar: {
      '/guide/': sidebarGuide,
      '/install/': sidebarInstall,
      '/operators/': sidebarOperators,
      '/architecture/': sidebarArchitecture,
      '/api/': sidebarApi,
    },
    search: {
      provider: 'local',
    },
    externalLinkIcon: true,
    outline: 'deep',
    editLink: {
      pattern:
        'https://github.com/LucaNerlich/directwerk/edit/main/directwerk-docs/docs/:path',
      text: 'Suggest changes to this page',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/LucaNerlich/directwerk' },
    ],
    footer: {
      message:
        'Directwerk — whitelabel publication infrastructure · API-first · Hosted in the EU',
      copyright: 'Copyright © Directwerk',
    },
  },
  extends: await openApiDocs({
    specs: [
      {
        name: 'directwerk',
        spec: 'docs/openapi/directwerk-api.json',
        prefix: '/api/reference',
      },
    ],
  }),
})
