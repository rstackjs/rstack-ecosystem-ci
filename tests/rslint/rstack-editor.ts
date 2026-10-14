import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

// Only unit tests run for now. E2E tests are excluded because they need
// VS Code and a display server.
export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rstack-editor',
    branch: process.env.RSTACK_EDITOR ?? 'main',
    test: 'test:unit',
  });
}
