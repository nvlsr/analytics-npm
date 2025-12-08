import { defineConfig, type Format } from 'tsup'
import { readFileSync, writeFileSync } from 'fs'

const commonConfig = {
  format: ['cjs', 'esm'] as Format[],
  dts: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'next',
    'next/server',
    'next/navigation',
    'next/router',
    'next/head'
  ],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
}

function injectUseClient() {
  const files = ['dist/index.js', 'dist/index.mjs']
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf8')
      if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
        writeFileSync(file, `"use client";\n${content}`)
        console.log(`✓ Injected "use client" into ${file}`)
      }
    } catch (e) {
      console.log(`⚠ Could not inject into ${file}:`, e.message)
    }
  })
}

export default defineConfig([
  {
    ...commonConfig,
    entry: { index: 'src/index.ts' },
    clean: true,
    onSuccess: async () => {
      console.log('Client bundle built successfully!')
      injectUseClient()
    },
  },
  {
    ...commonConfig,
    entry: { server: 'src/server.ts' },
    clean: false,
    onSuccess: async () => {
      console.log('Server bundle built successfully!')
    },
  }
]) 