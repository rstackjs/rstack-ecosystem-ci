// Configuration guide: https://rstack.rs/config
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild';
import { define } from 'rstack';
import { cloudflare } from 'rsbuild-plugin-cloudflare';

const dataSource =
  process.env.RSBUILD_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'remote';

define.app({
  plugins: [
    pluginReact(),
    cloudflare({ rsbuildEnvironment: { name: 'ssr' } }),
    tanstackStart(),
  ],
  source: {
    define: {
      'import.meta.env.RSBUILD_PUBLIC_DATA_SOURCE': JSON.stringify(dataSource),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5137,
  },
});
