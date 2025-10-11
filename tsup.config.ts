import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'next', 'next/server'],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
  esbuildOptions: (options) => {
    // Don't add global banners - let individual files handle their own directives
  },
  onSuccess: async () => {
    console.log('Build completed successfully!')
  },
}) 