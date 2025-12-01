import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rspack-dev-server',
    branch: 'main',
    test: ['test'],
  });
}
