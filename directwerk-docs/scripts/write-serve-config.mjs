import {writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const distDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs/.vitepress/dist',
)

writeFileSync(
  path.join(distDir, 'serve.json'),
  `${JSON.stringify({cleanUrls: true}, null, 2)}\n`,
)
