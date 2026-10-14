import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rspress',
    branch: process.env.RSPRESS_REF ?? 'main',
    beforeTest: 'pnpm exec playwright install --with-deps chromium',
    test: ['test'],
  });
}
