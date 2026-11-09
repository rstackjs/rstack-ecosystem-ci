import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}

const commitTimeFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCommitTime(timestamp: string) {
  return commitTimeFormat.format(new Date(timestamp));
}
