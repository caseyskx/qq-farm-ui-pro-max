import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const webRootDir = fileURLToPath(new URL('./', import.meta.url))
const projectRootDir = fileURLToPath(new URL('../', import.meta.url))
const configuredOutDir = process.env.WEB_DIST_DIR
const require = createRequire(import.meta.url)
interface WebDistUtils {
  FALLBACK_WEB_DIST_DIRNAME: string
  archiveDefaultWebDistForRecovery: (options?: {
    projectRoot?: string
    archiveDir?: string
    now?: Date | string | number
  }) => {
    recovered: boolean
    reason: string
    archiveDir: string
    archiveDirRelative: string
    error?: unknown
  }
  inspectWebDistState: (options?: {
    projectRoot?: string
    configuredPath?: string
  }) => {
    selectionReason: string
    defaultHasAssets: boolean
    fallbackDirRelative: string
  }
  resolveConfiguredWebDistDir: (configuredPath: string, projectRoot?: string, relativeBaseDir?: string) => string
  resolveBuildWebDistDir: (projectRoot?: string) => string
  syncDefaultWebDistToFallback: (options?: {
    projectRoot?: string
    now?: Date | string | number
  }) => {
    synced: boolean
    reason: string
    sourceDirRelative: string
    targetDirRelative: string
    error?: unknown
  }
}
const {
  FALLBACK_WEB_DIST_DIRNAME,
  archiveDefaultWebDistForRecovery,
  inspectWebDistState,
  resolveConfiguredWebDistDir,
  resolveBuildWebDistDir,
  syncDefaultWebDistToFallback,
} = require('../core/src/utils/web-dist.js') as WebDistUtils

function resolveBuildOutDir() {
  if (configuredOutDir)
    return relative(webRootDir, resolveConfiguredWebDistDir(configuredOutDir, projectRootDir, webRootDir))

  const resolvedOutDir = resolveBuildWebDistDir(projectRootDir)
  const relativeOutDir = relative(webRootDir, resolvedOutDir)
  if (relativeOutDir === FALLBACK_WEB_DIST_DIRNAME) {
    console.warn(`[vite] web/dist is not writable, building into web/${FALLBACK_WEB_DIST_DIRNAME}`)
    return relativeOutDir
  }

  const recoveryResult = archiveDefaultWebDistForRecovery({ projectRoot: projectRootDir })
  if (recoveryResult.recovered) {
    console.warn(`[vite] archived stale web/dist to ${recoveryResult.archiveDirRelative} and rebuilding web/dist`)
    return 'dist'
  }

  if (recoveryResult.reason === 'archive_failed') {
    const message = recoveryResult.error instanceof Error
      ? recoveryResult.error.message
      : String(recoveryResult.error || 'unknown error')
    console.warn(`[vite] failed to archive stale web/dist (${message}), checking fallback output directory`)
  }

  return relativeOutDir
}

const outDir = resolveBuildOutDir()

function emptyDirectoryContents(targetDir: string) {
  if (!existsSync(targetDir))
    return

  for (const entry of readdirSync(targetDir)) {
    const entryPath = resolve(targetDir, entry)
    rmSync(entryPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 120,
    })
  }
}

function safePrepareOutDir() {
  const targetDir = resolve(webRootDir, outDir)
  mkdirSync(targetDir, { recursive: true })
  emptyDirectoryContents(targetDir)
}

function syncFallbackAfterBuildIfNeeded() {
  if (configuredOutDir || outDir !== 'dist')
    return

  const state = inspectWebDistState({ projectRoot: projectRootDir, configuredPath: '' })
  if (state.selectionReason !== 'fallback_unwritable_default' || !state.defaultHasAssets)
    return

  const syncResult = syncDefaultWebDistToFallback({ projectRoot: projectRootDir })
  if (syncResult.synced) {
    console.warn(
      `[vite] mirrored latest ${syncResult.sourceDirRelative} into ${syncResult.targetDirRelative} because web/dist became non-writable after build`,
    )
    return
  }

  if (syncResult.reason === 'sync_failed') {
    const message = syncResult.error instanceof Error
      ? syncResult.error.message
      : String(syncResult.error || 'unknown error')
    console.warn(`[vite] failed to mirror latest build into ${state.fallbackDirRelative} (${message})`)
  }
}

export default defineConfig({
  plugins: [
    {
      name: 'safe-prepare-out-dir',
      apply: 'build',
      buildStart() {
        safePrepareOutDir()
      },
      closeBundle() {
        syncFallbackAfterBuildIfNeeded()
      },
    },
    vue(),
    UnoCSS() as any,
    viteCompression({
      verbose: false,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('@vueuse')) {
              return 'vendor-vue'
            }
            if (id.includes('axios')) {
              return 'vendor-axios'
            }
            // Split other large dependencies if needed
            if (id.includes('echarts') || id.includes('zrender')) {
              return 'vendor-echarts'
            }
            // Default vendor chunk
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/game-config': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/asset-cache': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ui-backgrounds': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
