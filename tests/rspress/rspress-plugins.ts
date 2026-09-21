import type { RunOptions } from '../../types';
import { $, runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rspress-plugins',
    branch: process.env.RSPRESS_PLUGINS_REF ?? 'main',
    build: 'build',
    beforeTest: async () => {
      await $`pnpm exec playwright install --with-deps chromium`;
    },
    test: ['docs:build', 'test', 'e2e'],
  });
}
