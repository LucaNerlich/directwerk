import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithOpenApi, OperationJumper } from 'vitepress-openapi-docs'
import specs, { defaults, prefixes } from 'virtual:vitepress-openapi-docs/specs'
import changelogs from 'virtual:vitepress-openapi-docs/changelogs'
import 'vue-api-playground/styles'
import 'vitepress-openapi-docs/styles'
import './custom.css'
import DocsBanner from './components/DocsBanner.vue'
import DocsNavCta from './components/DocsNavCta.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => [h(DocsBanner), h(OperationJumper)],
    })
  },
  enhanceApp({ app }) {
    app.component('DocsNavCta', DocsNavCta)
    enhanceAppWithOpenApi({ app, specs, changelogs, defaults, prefixes })
  },
} satisfies Theme
