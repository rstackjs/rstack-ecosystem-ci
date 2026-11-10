import { STACKS, type StackId } from '@/data/stacks';
import type { EcosystemCommitHistory } from '@/types';

const DATA_URL = 'https://ecosystem-ci-data.rstack.rs';

export default async function loadHistory(signal: AbortSignal) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const entries = await Promise.all(
    STACKS.map(async ({ id }) => {
      const response = await fetch(`${DATA_URL}/${id}.json`, {
        signal: requestSignal,
      });
      if (!response.ok) {
        throw new Error(`Failed to load ${id} history (${response.status})`);
      }
      const history: unknown = await response.json();
      if (!Array.isArray(history)) {
        throw new Error(`Invalid ${id} history: expected an array`);
      }
      return [id, history] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<StackId, EcosystemCommitHistory>;
}
