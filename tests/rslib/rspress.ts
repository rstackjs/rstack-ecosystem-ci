import type { RunOptions } from '../../types';
import { runRspressTests } from '../shared/rspress';

export async function test(options: RunOptions) {
  await runRspressTests(options, process.env.RSPRESS ?? 'main');
}
