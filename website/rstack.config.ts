// Configuration guide: https://rstack.rs/config
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild';
import { define } from 'rstack';

const dataSource =
  process.env.RSBUILD_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'remote';

const buildTime = new Date().toISOString();

define.app({
  plugins: [
    pluginReact(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: { outputPath: '/index' },
      },
    }),
  ],
  source: {
    define: {
      'import.meta.env.RSBUILD_PUBLIC_DATA_SOURCE': JSON.stringify(dataSource),
      'import.meta.env.RSBUILD_BUILD_TIME': JSON.stringify(buildTime),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@data':
        dataSource === 'mock'
          ? path.resolve(import.meta.dirname, './src/data/mock/history.ts')
          : path.resolve(import.meta.dirname, './src/data/remote/history.ts'),
    },
  },
  environments: {
    // Keep the existing Cloudflare Pages output directory static-only.
    client: { output: { distPath: { root: 'dist' } } },
    ssr: { output: { distPath: { root: '.tanstack/server' } } },
  },
  server: {
    port: 5137,
  },
});
