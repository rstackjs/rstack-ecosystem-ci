// Configuration guide: https://rstack.rs/config
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild';
import { define } from 'rstack';
import { cloudflare } from 'rsbuild-plugin-cloudflare';

// Workers Builds shares one build command between production and previews.
const buildBranch = process.env.WORKERS_CI_BRANCH;
if (process.env.WORKERS_CI === '1' && buildBranch) {
  process.env.CLOUDFLARE_PREVIEW_BUILD = String(buildBranch !== 'main');
}

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
