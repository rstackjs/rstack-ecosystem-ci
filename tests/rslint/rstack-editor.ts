import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

// `test:unit` runs the editor's unit tests, which load `@rslint/core` in the
// lint worker, and `lint` runs `rs lint --type-check`, which type-checks the
// editor against `@rslint/core` (the worker imports its `config-loader` and
// `eslint-plugin` modules) and uses that core as the linter engine.
// E2E tests are intentionally excluded because they need VS Code and a
// display server.
export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'rstackjs/rstack-editor',
    branch: process.env.RSTACK_EDITOR ?? 'main',
    test: ['test:unit', 'lint'],
  });
}
