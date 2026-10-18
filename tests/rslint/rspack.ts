import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rspack',
    branch: process.env.RSPACK ?? 'main',
    // Run the lint phase of upstream's `lint:js` (`rs check`).
    test: 'pnpm exec rs lint',
  });
}
