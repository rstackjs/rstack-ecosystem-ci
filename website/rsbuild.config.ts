import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const dataSource =
  process.env.RSBUILD_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'remote';

const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
    define: {
      'import.meta.env.RSBUILD_PUBLIC_DATA_SOURCE': JSON.stringify(dataSource),
      'import.meta.env.RSBUILD_BUILD_TIME': JSON.stringify(buildTime),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data':
        dataSource === 'mock'
          ? path.resolve(__dirname, './src/data/mock/history.ts')
          : path.resolve(__dirname, './src/data/remote/history.ts'),
    },
  },
  html: {
    template: './index.html',
    title: 'Ecosystem CI Timeline',
  },
  server: {
    port: 5137,
  },
});
