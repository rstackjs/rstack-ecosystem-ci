import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'james-elicx/rsbuild-plugin-cloudflare',
    branch: 'main',
    // The plugin links to packages built from its pinned workers-sdk submodule.
    beforeInstall: 'setup:upstream',
    build: 'pnpm --filter rsbuild-plugin-cloudflare run build',
    test: 'pnpm --filter rsbuild-plugin-cloudflare run test',
  });
}
