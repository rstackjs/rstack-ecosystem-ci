import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'rstack-ecosystem-ci',
    entrypoint: '@tanstack/react-start/server-entry',
    compatibilityDate: '2026-11-08',
  },
});
