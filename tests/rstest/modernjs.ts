import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/modern.js',
    branch: process.env.MODERNJS ?? 'main',
    test: ['test:unit'],
  });
}
