import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rstack-examples',
    branch: 'main',
    // Run the lint phase of upstream's `lint` script, which also checks formatting.
    test: 'pnpm exec rs lint',
  });
}
