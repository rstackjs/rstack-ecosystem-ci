import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runRspressTests(options, process.env.RSPRESS_REF ?? 'main');
}

export async function runRspressTests(options: RunOptions, branch: string) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rspress',
    branch,
    beforeTest: 'pnpm exec playwright install --with-deps chromium',
    test: ['test'],
  });
}
