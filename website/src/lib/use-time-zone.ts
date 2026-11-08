import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const getTimeZone = () => localTimeZone;
const getServerTimeZone = () => 'UTC';

// Use UTC for SSR and hydration, then restore the visitor's local time zone.
export function useTimeZone() {
  return useSyncExternalStore(subscribe, getTimeZone, getServerTimeZone);
}
