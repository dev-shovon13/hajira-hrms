import { defineConfig } from 'tsup';

export default defineConfig({
  // index: long-running server; vercel: the app alone, served as a Vercel function (api/index.js).
  entry: ['src/index.ts', 'src/vercel.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle the workspace package (TS source); everything else stays external.
  noExternal: ['@hajira/shared'],
});
