import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

// `test:unit` runs the editor's unit tests on Rstest, and `lint` runs
// `rs lint --type-check`, which type-checks the code against `@rstest/core`.
// E2E tests are intentionally excluded because they need VS Code and a
// display server.
export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rstack-editor',
    branch: 'main',
    test: ['test:unit', 'lint'],
  });
}
