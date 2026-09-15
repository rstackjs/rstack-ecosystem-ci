import type { RunOptions } from '../../types';
import { runInRepo } from '../../utils';

export async function test(options: RunOptions) {
  await runInRepo({
    ...options,
    repo: 'extension-js/extension.js',
    branch: process.env.EXTENSION_JS_REF ?? 'main',
    test: ['ci:test:rspack'],
  });
}
