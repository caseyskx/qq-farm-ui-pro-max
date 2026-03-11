import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = path.resolve(process.cwd(), 'src/constants/ui-appearance.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-appearance-check-'))
const tempFile = path.join(tempDir, 'ui-appearance.mjs')

try {
  fs.writeFileSync(tempFile, compiled, 'utf8')
  const mod = await import(pathToFileURL(tempFile).href)

  const oceanPreset = mod.getThemeBackgroundPreset('ocean')
  const oceanAppearance = mod.getThemeAppearanceConfig('ocean')
  assert.equal(oceanAppearance.workspaceVisualPreset, 'pure_glass')
  assert.equal(oceanAppearance.appBackgroundOverlayOpacity, oceanPreset.appOverlayOpacity)
  assert.equal(oceanAppearance.appBackgroundBlur, oceanPreset.appBlur)

  const sakuraPreset = mod.getThemeBackgroundPreset('sakura')
  const sakuraAppearance = mod.getThemeAppearanceConfig('sakura', 'global')
  assert.equal(sakuraAppearance.loginBackground, sakuraPreset.url)
  assert.equal(sakuraAppearance.backgroundScope, 'global')
  assert.equal(sakuraAppearance.workspaceVisualPreset, 'console')
  assert.equal(sakuraAppearance.appBackgroundOverlayOpacity, sakuraPreset.appOverlayOpacity)
  assert.equal(sakuraAppearance.appBackgroundBlur, sakuraPreset.appBlur)

  assert.equal(mod.getThemeWorkspaceVisualPreset('cyber'), 'poster')
  assert.equal(mod.getThemeWorkspaceVisualPreset('elegant'), 'poster')

  const workspaceAppearance = mod.getWorkspaceAppearanceConfig('poster')
  assert.equal(workspaceAppearance.workspaceVisualPreset, 'poster')
  assert.equal(workspaceAppearance.appBackgroundOverlayOpacity, 42)
  assert.equal(workspaceAppearance.appBackgroundBlur, 6)

  console.log('ui-appearance checks passed')
}
finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
