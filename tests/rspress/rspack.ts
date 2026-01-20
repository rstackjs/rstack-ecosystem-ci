import type { RunOptions } from '../../types';
import { cd, runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'web-infra-dev/rspack',
    branch: process.env.RSPACK ?? 'main',
    beforeTest: async () => {
      cd('./website');
    },
    test: ['pnpm run build'],
  });
}
