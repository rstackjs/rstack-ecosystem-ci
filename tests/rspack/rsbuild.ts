import type { RunOptions } from '../../types';
import { $, cd, runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rsbuild',
    branch: process.env.RSBUILD_REF ?? 'main',
    beforeTest: async () => {
      cd('./e2e');
      cd('..');
    },
    test: ['e2e'],
  });
}
