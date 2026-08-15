import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')
const rootDir = fileURLToPath(new URL('.', import.meta.url))
const outDir = resolve(rootDir, 'dist')

// Stamp the cache version from package.json so a release always
// invalidates the previous service worker cache. A missing declaration
// must fail the build, so this runs outside the copy error handling.
function stampServiceWorkerVersion(serviceWorkerPath, outputPath) {
  const source = readFileSync(serviceWorkerPath, 'utf8')
  const declaration = /^const CACHE_VERSION = '[^']*';$/m
  if (!declaration.test(source)) {
    throw new Error('sw.js is missing a rewritable CACHE_VERSION declaration')
  }
  writeFileSync(outputPath, source.replace(
    declaration,
    `const CACHE_VERSION = 'v${pkg.version}';`
  ))
}

// Plugin to copy tools directory and tools.json to dist
function copyToolsPlugin() {
  return {
    name: 'copy-tools',
    closeBundle() {
      const serviceWorker = resolve(rootDir, 'sw.js')
      if (existsSync(serviceWorker)) {
        stampServiceWorkerVersion(serviceWorker, resolve(outDir, 'sw.js'))
      }
      try {
        const toolsDir = resolve(rootDir, 'tools')
        const toolsData = resolve(rootDir, 'tools.json')
        const manifest = resolve(rootDir, 'manifest.json')
        const favicon = resolve(rootDir, 'favicon.svg')
        const sitemap = resolve(rootDir, 'sitemap.xml')
        const robots = resolve(rootDir, 'robots.txt')

        if (existsSync(toolsDir)) {
          cpSync(toolsDir, resolve(outDir, 'tools'), { recursive: true, force: true })
        }
        if (existsSync(toolsData)) {
          copyFileSync(toolsData, resolve(outDir, 'tools.json'))
        }
        if (existsSync(manifest)) {
          copyFileSync(manifest, resolve(outDir, 'manifest.json'))
        }
        if (existsSync(favicon)) {
          copyFileSync(favicon, resolve(outDir, 'favicon.svg'))
        }
        if (existsSync(sitemap)) {
          copyFileSync(sitemap, resolve(outDir, 'sitemap.xml'))
        }
        if (existsSync(robots)) {
          copyFileSync(robots, resolve(outDir, 'robots.txt'))
        }
        console.log('✓ Files copied to dist/')
      } catch (err) {
        console.error('Failed to copy files:', err)
        // Don't fail the build on copy error
      }
    }
  }
}

export default defineConfig(({ mode }) => ({
  root: rootDir,
  base: './',
  build: {
    outDir,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html')
      },
      output: {
        entryFileNames: 'assets/main.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames(assetInfo) {
          if (assetInfo.name === 'manifest.json' || assetInfo.name === 'favicon.svg') {
            return '[name][extname]'
          }
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/main.css'
          }
          return 'assets/[name][extname]'
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        side_effects: true
      }
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: mode !== 'production' // 生产环境禁用 sourcemap
  },
  server: {
    port: 3001, // 避免与后端端口冲突
    open: true,
    cors: true
  },
  preview: {
    port: 4173
  },
  css: {
    devSourcemap: true
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [copyToolsPlugin()]
}))
