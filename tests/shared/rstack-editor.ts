import assert from 'node:assert';
import path from 'node:path';
import type { RunOptions } from '../../types';
import {
  execa,
  getMonorepoPackages,
  getRslintPackages,
  runInRepo,
} from '../../utils';

const REPO = 'rstackjs/rstack-editor';

// `test:unit` runs the editor's unit tests on the stack in question, `lint`
// runs `rs lint --type-check`, and `build` produces `packages/vscode/dist`,
// which the E2E extension host loads.
//
// The E2E fixtures install published packages, so the unreleased stack build
// is injected through `RSTACK_E2E_TOOLCHAIN_OVERRIDES` (tarballs packed from
// the stack checkout), never through eco-ci's consumer overrides. Rslint needs
// both `@rslint/core` and its host `@rslint/native-<tuple>`: core resolves its
// binary through `require.resolve('@rslint/native-<tuple>/bin')`, so
// overriding core alone would leave the published binary in place. Rstest
// needs only `@rstest/core`, found by package name through the cached
// monorepo scan, so neither suite hardcodes the upstream layout.
async function toolchainOverrides(options: RunOptions): Promise<string> {
  if (options.stack === 'rslint') {
    return getRslintPackages(options.stackPath)
      .map(({ name, directory }) => `${name}=${directory}`)
      .join(',');
  }
  const core = (await getMonorepoPackages('rstest')).find(
    ({ name }) => name === '@rstest/core',
  );
  assert(core, `@rstest/core not found in ${options.stackPath}`);
  return `@rstest/core=${core.directory}`;
}

// The VS Code download is cached beside the checkout because runInRepo runs
// `git clean -fdxq` in it and would otherwise wipe `.vscode-test/`. Only the
// rslint suite has ever taken its branch from `RSTACK_EDITOR`.
export async function test(options: RunOptions) {
  assert(
    options.stack === 'rstest' || options.stack === 'rslint',
    `rstack-editor E2E does not support the ${options.stack} stack`,
  );
  const isRstest = options.stack === 'rstest';
  await runInRepo({
    ...options,
    repo: REPO,
    branch: isRstest ? 'main' : (process.env.RSTACK_EDITOR ?? 'main'),
    build: 'build',
    test: [
      'test:unit',
      'lint',
      async ({ dir }) => {
        await execa(`node e2e/run.mjs ${isRstest ? 'rstest' : 'smoke lint'}`, {
          cwd: path.join(dir, 'packages/vscode'),
          env: {
            RSTACK_E2E_TOOLCHAIN_OVERRIDES: await toolchainOverrides(options),
            VSCODE_TEST_CACHE_PATH: path.join(
              options.workspace,
              '.vscode-test',
            ),
          },
        });
      },
    ],
  });
}
