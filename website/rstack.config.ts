// Configuration guide: https://rstack.rs/config
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild';
import { define } from 'rstack';
import { cloudflare } from 'rsbuild-plugin-cloudflare';

define.app({
  plugins: [
    pluginReact(),
    cloudflare({ rsbuildEnvironment: { name: 'ssr' } }),
    tanstackStart(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5137,
  },
});
