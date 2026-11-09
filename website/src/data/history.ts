import loadRemoteHistory from './remote/history';

export default async function loadHistory(signal: AbortSignal) {
  if (import.meta.env.RSBUILD_PUBLIC_DATA_SOURCE === 'mock') {
    const { default: loadMockHistory } = await import('./mock/history');
    return loadMockHistory();
  }

  return loadRemoteHistory(signal);
}
