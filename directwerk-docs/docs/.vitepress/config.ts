import path from 'node:path'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { diagramPlugin } from 'vitepress-plugin-mermaid-diagram'
import { openApiDocs } from 'vitepress-openapi-docs/vitepress'

const docsPackageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const pnpmDir = path.resolve(docsPackageRoot, '../node_modules/.pnpm')
const vueApiPlaygroundDir = readdirSync(pnpmDir).find((entry) =>
  entry.startsWith('vue-api-playground@'),
)
if (!vueApiPlaygroundDir) {
  throw new Error(
    'vue-api-playground is missing. Run pnpm install from the monorepo root.',
  )
}
const vueApiPlaygroundRoot = path.join(
  pnpmDir,
  vueApiPlaygroundDir,
  'node_modules/vue-api-playground',
)
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
  head: [['meta', { name: 'theme-color', content: '#3b4a9e' }]],
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
    socialLinks: [],
    footer: {
      message: 'Directwerk — whitelabel publication infrastructure',
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
