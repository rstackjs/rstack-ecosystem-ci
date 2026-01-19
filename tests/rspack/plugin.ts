import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rspack-plugin-ci',
    branch: 'main',
    test: ['test'],
  });
}
