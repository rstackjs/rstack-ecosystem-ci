import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useSearchParams } from 'react-router-dom';

import { Timeline } from '@/components/timeline';
import { Badge } from '@/components/ui/badge';
import { cn, formatCommitTime, shortSha } from '@/lib/utils';
import type { EcosystemCommitHistory, EcosystemCommitRecord } from '@/types';
// @ts-expect-error dynamic data source alias
import history from '@data';

const DATA_SOURCE =
  import.meta.env.RSBUILD_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'remote';

/** Build timestamp injected at compile time */
const BUILD_TIME = import.meta.env.RSBUILD_BUILD_TIME as string | undefined;

const STACKS = [
  { id: 'rspack', label: 'Rspack' },
  { id: 'rsbuild', label: 'Rsbuild' },
  { id: 'rslib', label: 'Rslib' },
  { id: 'rstest', label: 'Rstest' },
  { id: 'rsdoctor', label: 'Rsdoctor' },
  { id: 'rspress', label: 'Rspress' },
  { id: 'rslint', label: 'Rslint' },
] as const;

type StackId = (typeof STACKS)[number]['id'];
type StackStatus = EcosystemCommitRecord['overallStatus'] | 'missing';

const DEFAULT_STACK: StackId = 'rspack';

const GITHUB_REPO_URL = 'https://github.com/rstackjs/rstack-ecosystem-ci';

const RSTACK_REPOS = [
  { label: 'Rspack', url: 'https://github.com/web-infra-dev/rspack' },
  { label: 'Rsbuild', url: 'https://github.com/web-infra-dev/rsbuild' },
  { label: 'Rslib', url: 'https://github.com/web-infra-dev/rslib' },
  { label: 'Rstest', url: 'https://github.com/web-infra-dev/rstest' },
  { label: 'Rsdoctor', url: 'https://github.com/web-infra-dev/rsdoctor' },
  { label: 'Rspress', url: 'https://github.com/web-infra-dev/rspress' },
  { label: 'Rslint', url: 'https://github.com/web-infra-dev/rslint' },
] as const;

export default function App() {
  const historySource = history as Record<StackId, EcosystemCommitHistory>;
  const [searchParams, setSearchParams] = useSearchParams();

  const [isRepoMenuOpen, setIsRepoMenuOpen] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => new Date());

  const selectedStackParam = searchParams.get('stack') as StackId | null;
  const hasValidStack =
    selectedStackParam != null &&
    STACKS.some((stack) => stack.id === selectedStackParam);
  const selectedStack: StackId = hasValidStack
    ? selectedStackParam
    : DEFAULT_STACK;

  const selectedSuite = searchParams.get('suite') ?? 'all';

  const historyByStack = useMemo(() => {
    const map = {} as Record<StackId, EcosystemCommitHistory>;
    for (const { id } of STACKS) {
      const list = historySource[id] ?? [];
      map[id] = [...list].sort(
        (a, b) =>
          new Date(b.commitTimestamp).getTime() -
          new Date(a.commitTimestamp).getTime(),
      );
    }
    return map;
  }, [historySource]);

  useEffect(() => {
    if (!hasValidStack) {
      const params = new URLSearchParams(searchParams);
      params.set('stack', DEFAULT_STACK);
      if ((params.get('suite') ?? 'all') === 'all') {
        params.delete('suite');
      }
      setSearchParams(params, { replace: true });
    }
  }, [hasValidStack, searchParams, setSearchParams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isRepoMenuOpen) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (!repoMenuRef.current?.contains(event.target as Node)) {
        setIsRepoMenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsRepoMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isRepoMenuOpen]);

  const handleStackChange = useCallback(
    (nextStack: StackId) => {
      if (nextStack === selectedStack) {
        return;
      }
      const params = new URLSearchParams(searchParams);
      params.set('stack', nextStack);
      setSearchParams(params);
    },
    [searchParams, selectedStack, setSearchParams],
  );

  const [focusRequest, setFocusRequest] = useState<{
    sha: string;
    nonce: number;
  } | null>(null);

  const handleRunSelect = useCallback(
    (stack: StackId, sha: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('stack', stack);
      params.delete('suite');
      setSearchParams(params);
      setFocusRequest((prev) => ({ sha, nonce: (prev?.nonce ?? 0) + 1 }));
    },
    [searchParams, setSearchParams],
  );

  const handleSuiteChange = useCallback(
    (suite: string) => {
      const params = new URLSearchParams(searchParams);
      if (!params.get('stack')) {
        params.set('stack', selectedStack);
      }
      if (!suite || suite === 'all') {
        params.delete('suite');
      } else {
        params.set('suite', suite);
      }
      setSearchParams(params);
    },
    [searchParams, selectedStack, setSearchParams],
  );

  const stackEntries = historyByStack[selectedStack] ?? [];
  const stackStatusSummary = useMemo(
    () => buildStackStatuses(historyByStack),
    [historyByStack],
  );
  const stackOptions = useMemo(
    () =>
      STACKS.map((stack) => ({
        id: stack.id,
        label: stack.label,
      })),
    [],
  );
  const schedule = useMemo(() => buildUpdateSchedule(now), [now]);

  return (
    <div className="min-h-screen px-4 py-10 text-foreground sm:px-6 sm:py-14">
      <div
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 outline-hidden"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="relative hidden size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface sm:flex">
              <img
                src="https://assets.rspack.rs/rspack/rspack-logo.svg"
                alt=""
                width="28"
                height="28"
                className="size-7"
              />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Rstack Ecosystem CI
                </h1>
                {DATA_SOURCE === 'mock' ? (
                  <Badge variant="warning">Mock data</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Downstream test results for every Rstack project
              </p>
              <p className="mt-2 flex flex-col font-mono text-xs text-subtle-foreground sm:flex-row sm:flex-wrap sm:gap-x-1.5">
                <span>Updated {schedule.lastUpdated ?? '—'}</span>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span>
                  Next refresh{' '}
                  {formatCountdown(schedule.countdownMinutes) ?? '—'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-white/[0.04] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              aria-label="Open GitHub repository"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-[18px]"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.48 0 12.24c0 5.41 3.44 9.99 8.2 11.61.6.12.82-.27.82-.59 0-.29-.01-1.05-.02-2.05-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.35-1.81-1.35-1.81-1.1-.77.08-.75.08-.75 1.22.09 1.86 1.28 1.86 1.28 1.08 1.9 2.83 1.35 3.52 1.03.11-.81.42-1.35.76-1.66-2.67-.31-5.47-1.37-5.47-6.12 0-1.35.47-2.45 1.24-3.31-.13-.31-.54-1.56.12-3.26 0 0 1-.33 3.3 1.26a11.1 11.1 0 0 1 3-.41c1.02 0 2.05.14 3 .41 2.3-1.59 3.3-1.26 3.3-1.26.66 1.7.25 2.95.12 3.26.77.86 1.24 1.96 1.24 3.31 0 4.76-2.8 5.8-5.48 6.11.43.39.81 1.17.81 2.36 0 1.7-.02 3.07-.02 3.48 0 .32.22.71.82.59C20.56 22.23 24 17.65 24 12.24 24 5.48 18.63 0 12 0Z" />
              </svg>
            </a>

            <div className="relative" ref={repoMenuRef}>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-white/[0.04] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400/40 aria-expanded:border-border-strong aria-expanded:text-foreground"
                aria-haspopup="menu"
                aria-expanded={isRepoMenuOpen}
                aria-label="Toggle menu"
                onClick={() => setIsRepoMenuOpen((open) => !open)}
              >
                Rstack
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-3.5 transition-transform duration-200',
                    isRepoMenuOpen && 'rotate-180',
                  )}
                />
              </button>
              {isRepoMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-xl border border-border-strong bg-popover p-1 shadow-2xl shadow-black/60 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
                  <ul className="flex flex-col">
                    {RSTACK_REPOS.map((repo) => (
                      <li key={repo.url}>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-foreground/75 transition-colors hover:bg-white/[0.06] hover:text-foreground"
                          onClick={() => setIsRepoMenuOpen(false)}
                        >
                          {repo.label}
                          <ArrowUpRight
                            aria-hidden
                            className="size-3.5 text-subtle-foreground transition-colors group-hover:text-muted-foreground"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <StackCards
          statuses={stackStatusSummary}
          activeStack={selectedStack}
          onSelect={handleStackChange}
          onSelectRun={handleRunSelect}
        />

        <Timeline
          entries={stackEntries}
          stacks={stackOptions}
          selectedStack={selectedStack}
          selectedSuite={selectedSuite}
          onSuiteChange={handleSuiteChange}
          focusRequest={focusRequest}
        />
      </div>
    </div>
  );
}

const RECENT_RUN_COUNT = 20;

interface StackStatusSummary {
  id: StackId;
  label: string;
  status: StackStatus;
  /** Most recent runs, oldest first. */
  recent: EcosystemCommitRecord[];
  passRate: number | null;
}

function buildStackStatuses(
  historyByStack: Record<StackId, EcosystemCommitHistory>,
) {
  return STACKS.map((stack) => {
    const records = historyByStack[stack.id] ?? [];
    const latest = records[0] ?? null;

    const recent = records.slice(0, RECENT_RUN_COUNT).reverse();
    const passed = recent.filter(
      (record) => record.overallStatus === 'success',
    ).length;

    return {
      id: stack.id,
      label: stack.label,
      status: latest?.overallStatus ?? 'missing',
      recent,
      passRate: recent.length > 0 ? passed / recent.length : null,
    };
  });
}

interface UpdateSchedule {
  lastUpdated: string | null;
  countdownMinutes: number | null;
}

/** Schedule times in UTC hours: 01:00–18:00 (09:00–02:00+1 Beijing, hourly) */
const SCHEDULE_HOURS_UTC = Array.from({ length: 18 }, (_, i) => i + 1);

function buildUpdateSchedule(referenceTime: Date): UpdateSchedule {
  const nextUpdate = getNextScheduledTime(referenceTime);

  const countdownMinutes = Math.max(
    0,
    Math.floor((nextUpdate.getTime() - referenceTime.getTime()) / 60_000),
  );

  // Use actual build time if available, otherwise fall back to calculated previous schedule
  const lastUpdated = BUILD_TIME
    ? formatTimestamp(new Date(BUILD_TIME))
    : formatTimestamp(getPrevScheduledTime(referenceTime));

  return {
    lastUpdated,
    countdownMinutes,
  };
}

function formatTimestamp(date: Date) {
  const dateStr = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  const offset = -date.getTimezoneOffset() / 60;
  const utcStr = `UTC${offset >= 0 ? '+' : ''}${offset}`;
  return `${dateStr} ${utcStr}`;
}

/** Build a Date for a specific UTC hour on a given day (offset in days from base). */
function buildScheduleTime(base: Date, dayOffset: number, utcHour: number) {
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(utcHour);
  return d;
}

/** Get candidates: yesterday's, today's, and tomorrow's scheduled times. */
function getScheduleCandidates(base: Date) {
  return [-1, 0, 1].flatMap((offset) =>
    SCHEDULE_HOURS_UTC.map((hour) => buildScheduleTime(base, offset, hour)),
  );
}

/** Returns the most recent scheduled time at or before `now`. */
function getPrevScheduledTime(now: Date) {
  const nowMs = now.getTime();
  const candidates = getScheduleCandidates(now).filter(
    (d) => d.getTime() <= nowMs,
  );
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

/** Returns the next scheduled time strictly after `now`. */
function getNextScheduledTime(now: Date) {
  const nowMs = now.getTime();
  const candidates = getScheduleCandidates(now).filter(
    (d) => d.getTime() > nowMs,
  );
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

function formatCountdown(minutes: number | null) {
  if (minutes == null) {
    return null;
  }

  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours > 0) {
    return mins > 0 ? `in ${hours}h ${mins}min` : `in ${hours}h`;
  }
  return `in ${safeMinutes}min`;
}

const STATUS_STYLE: Record<
  StackStatus,
  {
    label: string;
    runLabel: string;
    dot: string;
    text: string;
    segment: string;
  }
> = {
  success: {
    label: 'Passing',
    runLabel: 'passed',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    segment: 'bg-emerald-400/35',
  },
  failure: {
    label: 'Failing',
    runLabel: 'failed',
    dot: 'bg-rose-500',
    text: 'text-rose-300',
    segment: 'bg-rose-500/90',
  },
  cancelled: {
    label: 'Cancelled',
    runLabel: 'cancelled',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    segment: 'bg-amber-400/50',
  },
  missing: {
    label: 'No data',
    runLabel: 'missing',
    dot: 'bg-neutral-600',
    text: 'text-muted-foreground',
    segment: 'bg-white/[0.06]',
  },
};

interface StackCardsProps {
  statuses: StackStatusSummary[];
  activeStack: StackId;
  onSelect: (stack: StackId) => void;
  onSelectRun: (stack: StackId, sha: string) => void;
}

function StackCards({
  statuses,
  activeStack,
  onSelect,
  onSelectRun,
}: StackCardsProps) {
  return (
    <Tooltip.Provider delayDuration={80} skipDelayDuration={300}>
      <section
        aria-label="Stack health"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
      >
        {statuses.map((stack) => {
          const isActive = stack.id === activeStack;
          const isFailing = stack.status === 'failure';
          const status = STATUS_STYLE[stack.status];
          const emptySlots = RECENT_RUN_COUNT - stack.recent.length;
          return (
            <div
              key={stack.id}
              className={cn(
                'relative flex min-w-0 flex-col gap-3 rounded-xl p-3 ring-1 transition-[background-color,box-shadow] duration-150 has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-cyan-400/50',
                isFailing
                  ? 'bg-rose-500/10 hover:bg-rose-500/15'
                  : 'bg-white/[0.03] hover:bg-white/[0.05]',
                isActive ? 'ring-white/35' : 'ring-transparent',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(stack.id)}
                aria-pressed={isActive}
                aria-label={`${stack.label}: ${status.label}`}
                className="absolute inset-0 rounded-xl focus-visible:outline-hidden"
              />

              <span className="pointer-events-none flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {stack.label}
                </span>
                <span
                  className={cn('size-2 shrink-0 rounded-full', status.dot)}
                  aria-hidden
                />
              </span>

              <span className="pointer-events-none flex items-baseline justify-between gap-2">
                <span className={cn('text-xs font-medium', status.text)}>
                  {status.label}
                </span>
                <span className="font-mono text-[11px] text-subtle-foreground">
                  {stack.passRate == null
                    ? 'No runs'
                    : `${Math.round(stack.passRate * 100)}% pass`}
                </span>
              </span>

              <div
                className="relative -my-1.5 flex gap-[2px]"
                role="group"
                aria-label={`${stack.label}: last ${stack.recent.length} runs, oldest to newest`}
              >
                {Array.from({ length: emptySlots }, (_, index) => (
                  <span
                    key={`empty-${index}`}
                    aria-hidden
                    className="pointer-events-none flex h-4 flex-1 items-center"
                  >
                    <span
                      className={cn(
                        'h-1.5 w-full rounded-full',
                        STATUS_STYLE.missing.segment,
                      )}
                    />
                  </span>
                ))}
                {stack.recent.map((run, index) => (
                  <RunSegment
                    key={run.commitSha}
                    run={run}
                    isLatest={index === stack.recent.length - 1}
                    stackLabel={stack.label}
                    onSelect={() => onSelectRun(stack.id, run.commitSha)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </Tooltip.Provider>
  );
}

interface RunSegmentProps {
  run: EcosystemCommitRecord;
  isLatest: boolean;
  stackLabel: string;
  onSelect: () => void;
}

function RunSegment({ run, isLatest, stackLabel, onSelect }: RunSegmentProps) {
  const sha = shortSha(run.commitSha);
  const style = STATUS_STYLE[run.overallStatus];
  const label = style.runLabel;
  const failed = run.suites.filter((suite) => suite.status === 'failure');
  const passedCount = run.suites.filter(
    (suite) => suite.status === 'success',
  ).length;
  const title = run.commitMessage.split('\n')[0];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Show ${stackLabel} run ${sha} (${label})`}
          className="group/run flex h-4 flex-1 items-center rounded-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-cyan-400/70"
        >
          <span
            className={cn(
              'h-1.5 w-full rounded-full transition-[height,filter] duration-100 group-hover/run:h-2.5 group-hover/run:brightness-150',
              isLatest ? style.dot : style.segment,
            )}
          />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-72 rounded-lg border border-border-strong bg-popover p-3 text-xs shadow-xl shadow-black/60 animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span
                className={cn('size-1.5 rounded-full', style.dot)}
                aria-hidden
              />
              <span className="text-foreground">{sha}</span>
              <span className={style.text}>{label}</span>
            </span>
            <span className="text-subtle-foreground">
              {formatCommitTime(run.commitTimestamp)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-foreground">
            {title}
          </p>
          <p className="mt-1 text-muted-foreground">
            {run.author.login ?? run.author.name} · {passedCount}/
            {run.suites.length} suites passed
          </p>
          {failed.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {failed.slice(0, 6).map((suite) => (
                <span
                  key={suite.name}
                  className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[11px] text-rose-300"
                >
                  {suite.name}
                </span>
              ))}
              {failed.length > 6 && (
                <span className="px-1 py-0.5 font-mono text-[11px] text-subtle-foreground">
                  +{failed.length - 6}
                </span>
              )}
            </div>
          )}
          <p className="mt-2 border-t border-border pt-2 text-[11px] text-subtle-foreground">
            Click to jump to this run
          </p>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
