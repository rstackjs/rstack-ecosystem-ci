import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowUpRight,
  Check,
  CircleMinus,
  CircleX,
  Search,
  SearchX,
  Sparkles,
} from 'lucide-react';
import { createPortal } from 'react-dom';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildAgentPrompt } from '@/lib/agent-prompt';
import { cn, formatCommitTime, shortSha } from '@/lib/utils';
import type { EcosystemCommitRecord, EcosystemSuiteResult } from '@/types';

type CopyStatus = 'copied' | 'failed';

const COPY_LABELS: Record<CopyStatus, string> = {
  copied: 'Copied!',
  failed: 'Copy failed',
};

const commitStatusStyles = {
  success: {
    bar: 'bg-transparent',
    badge: 'success' as const,
    label: 'Passed',
  },
  failure: {
    bar: 'bg-danger',
    badge: 'destructive' as const,
    label: 'Failed',
  },
  cancelled: {
    bar: 'bg-amber-400/60',
    badge: 'warning' as const,
    label: 'Cancelled',
  },
} as const;

const issueSuiteStyles = {
  failure: {
    container:
      'border-rose-500/30 bg-rose-500/10 text-rose-100 hover:border-rose-400/50 hover:bg-rose-500/15',
    icon: CircleX,
    iconClass: 'text-rose-400',
    label: 'Failed',
  },
  cancelled: {
    container:
      'border-amber-400/25 bg-amber-400/[0.07] text-amber-100 hover:border-amber-400/45 hover:bg-amber-400/10',
    icon: CircleMinus,
    iconClass: 'text-amber-400',
    label: 'Skipped',
  },
} as const;

/** Rose tint whose strength scales with the share of failed suites. */
function failureTint(failedRatio: number) {
  const alpha = 0.04 + 0.2 * Math.min(Math.max(failedRatio, 0), 1);
  return `color-mix(in srgb, var(--color-danger) ${(alpha * 100).toFixed(1)}%, transparent)`;
}

function formatDuration(durationMs: number | undefined) {
  return typeof durationMs === 'number'
    ? `${Math.round(durationMs / 1000)}s`
    : null;
}

interface InspectPromptButtonProps {
  copyStatus: CopyStatus | null;
  stackLabel: string | null;
  onClick: () => void;
}

function InspectPromptButton({
  copyStatus,
  stackLabel,
  onClick,
}: InspectPromptButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const isCopied = copyStatus === 'copied';

  useLayoutEffect(() => {
    if (!isCopied) {
      setTooltipPos(null);
      return;
    }
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = { top: rect.top, left: rect.left + rect.width / 2 };
      // Diff numerically — without this, every scroll tick allocates a
      // fresh object and re-renders the portal, defeating React's bail-out.
      setTooltipPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left ? prev : next,
      );
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isCopied]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400/40',
          isCopied
            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
            : copyStatus === 'failed'
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
              : 'border-border text-foreground/80 hover:border-border-strong hover:bg-white/[0.05] hover:text-foreground',
        )}
        title="Copy a prompt to paste into an AI agent to diagnose this failure"
      >
        {isCopied ? (
          <Check aria-hidden className="size-3.5" />
        ) : (
          <Sparkles aria-hidden className="size-3.5" />
        )}
        {copyStatus ? COPY_LABELS[copyStatus] : 'Inspect prompt'}
      </button>
      {isCopied && stackLabel && tooltipPos
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-xl shadow-black/60 motion-safe:animate-in motion-safe:fade-in-0"
              style={{ top: tooltipPos.top - 8, left: tooltipPos.left }}
            >
              Paste the prompt to agent within {stackLabel} to inspect
              <span
                aria-hidden
                className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-border-strong bg-popover"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface TimelineProps {
  entries: EcosystemCommitRecord[];
  selectedSuite?: string;
  onSuiteChange?: (suite: string) => void;
  stacks?: Array<{
    id: string;
    label: string;
  }>;
  selectedStack?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Scroll to and briefly highlight this commit; `nonce` re-triggers it. */
  focusRequest?: { sha: string; nonce: number } | null;
}

export function Timeline({
  entries,
  selectedSuite: externalSelectedSuite,
  onSuiteChange,
  stacks,
  selectedStack: externalSelectedStack,
  searchQuery: externalSearchQuery,
  onSearchChange,
  focusRequest,
}: TimelineProps) {
  const [internalSelectedSuite, setInternalSelectedSuite] =
    useState<string>('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [copyState, setCopyState] = useState<{
    sha: string;
    status: CopyStatus;
  } | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const handleCopyPrompt = useCallback(
    async (entry: EcosystemCommitRecord) => {
      if (!externalSelectedStack) return;
      // When a suite filter is active, `entry` comes from `suiteFilteredEntries`
      // with a narrowed `suites` array — look up the unfiltered record by SHA
      // so the prompt reflects every failing suite on the commit.
      const fullEntry =
        entries.find((e) => e.commitSha === entry.commitSha) ?? entry;
      const prompt = buildAgentPrompt({
        entry: fullEntry,
        stackId: externalSelectedStack,
        history: entries,
      });

      const setState = (status: CopyStatus) => {
        setCopyState({ sha: entry.commitSha, status });
        if (copyTimerRef.current != null) {
          window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
          setCopyState(null);
          copyTimerRef.current = null;
        }, 2000);
      };

      try {
        await navigator.clipboard.writeText(prompt);
        setState('copied');
        return;
      } catch {
        // Fall through to legacy execCommand path (headless / non-secure contexts).
      }

      try {
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        setState(ok ? 'copied' : 'failed');
      } catch {
        setState('failed');
      }
    },
    [entries, externalSelectedStack],
  );

  const selectedSuite = externalSelectedSuite ?? internalSelectedSuite;
  const setSelectedSuite = onSuiteChange ?? setInternalSelectedSuite;
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onSearchChange ?? setInternalSearchQuery;

  const allSuiteNames = useMemo(() => {
    const names = new Set<string>();
    for (const entry of entries) {
      for (const suite of entry.suites) {
        names.add(suite.name);
      }
    }
    return Array.from(names).sort();
  }, [entries]);

  const suiteFilteredEntries = useMemo(() => {
    if (selectedSuite === 'all') {
      return entries;
    }
    return entries
      .map((entry) => ({
        ...entry,
        suites: entry.suites.filter((suite) => suite.name === selectedSuite),
      }))
      .filter((entry) => entry.suites.length > 0);
  }, [entries, selectedSuite]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return suiteFilteredEntries;
    }
    return suiteFilteredEntries.filter(
      (entry) =>
        entry.commitMessage.toLowerCase().includes(q) ||
        entry.commitSha.toLowerCase().includes(q) ||
        entry.author?.name?.toLowerCase().includes(q) ||
        entry.author?.login?.toLowerCase().includes(q) ||
        entry.suites.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [suiteFilteredEntries, searchQuery]);

  const selectedStackMeta = useMemo(() => {
    if (!stacks?.length || !externalSelectedStack) {
      return null;
    }
    return stacks.find((stack) => stack.id === externalSelectedStack) ?? null;
  }, [stacks, externalSelectedStack]);

  const virtualizer = useWindowVirtualizer({
    count: filteredEntries.length,
    estimateSize: () => 180,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const [highlightedSha, setHighlightedSha] = useState<string | null>(null);
  const handledFocusNonce = useRef(0);

  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === handledFocusNonce.current) {
      return;
    }
    const index = filteredEntries.findIndex(
      (entry) => entry.commitSha === focusRequest.sha,
    );
    if (index === -1) {
      // The search box may hide the run; clear it and retry on the next pass.
      if (searchQuery) {
        setSearchQuery('');
      }
      return;
    }
    handledFocusNonce.current = focusRequest.nonce;
    setHighlightedSha(focusRequest.sha);
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(index, { align: 'center' });
    });
  }, [focusRequest, filteredEntries, searchQuery, setSearchQuery, virtualizer]);

  useEffect(() => {
    if (!highlightedSha) {
      return;
    }
    const timer = window.setTimeout(() => setHighlightedSha(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedSha]);

  const renderEntry = useCallback(
    (entry: EcosystemCommitRecord) => {
      const commitStyles =
        commitStatusStyles[entry.overallStatus] ?? commitStatusStyles.failure;
      const formattedDate = formatCommitTime(entry.commitTimestamp);
      const sha = shortSha(entry.commitSha);
      const commitUrl = `https://github.com/${entry.repository.fullName}/commit/${entry.commitSha}`;
      const stackLabel = selectedStackMeta?.label;
      const isRenovateBot = entry.author?.login === 'renovate[bot]';
      const isFailure = entry.overallStatus === 'failure';
      const sortedSuites = [...entry.suites].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const issueSuites: EcosystemSuiteResult[] = [];
      const passedSuites: EcosystemSuiteResult[] = [];
      let failedCount = 0;
      for (const suite of sortedSuites) {
        (suite.status === 'success' ? passedSuites : issueSuites).push(suite);
        if (suite.status === 'failure') {
          failedCount += 1;
        }
      }
      const failedRatio =
        sortedSuites.length > 0 ? failedCount / sortedSuites.length : 0;
      const avatarUrl = isRenovateBot
        ? 'https://avatars.githubusercontent.com/in/2740?s=80&v=4'
        : (entry.author?.avatarUrl ??
          (entry.author?.login
            ? `https://github.com/${entry.author.login}.png`
            : null));

      return (
        <div className="min-w-0 pb-2">
          <article
            className={cn(
              'relative overflow-hidden rounded-lg px-3 py-3 ring-cyan-400/0 transition-[background-color,box-shadow] duration-300 sm:px-4',
              !isFailure && 'bg-white/[0.03] hover:bg-white/[0.045]',
              highlightedSha === entry.commitSha && 'ring-2 ring-cyan-400/70',
            )}
            style={
              isFailure
                ? { backgroundColor: failureTint(failedRatio) }
                : undefined
            }
          >
            <span
              aria-hidden
              className={cn('absolute inset-y-0 left-0 w-1', commitStyles.bar)}
            />
            <div className="flex items-start gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width="28"
                  height="28"
                  loading="lazy"
                  className={cn(
                    'size-7 flex-none bg-white/5 ring-1 ring-border',
                    isRenovateBot ? 'rounded-md' : 'rounded-full',
                  )}
                />
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium tracking-tight sm:text-[15px]">
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 break-words text-foreground decoration-foreground/30 underline-offset-4 hover:underline sm:line-clamp-1"
                      title={entry.commitMessage}
                    >
                      {entry.commitMessage}
                    </a>
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <a
                      className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-foreground/80 transition-colors hover:bg-white/10 hover:text-foreground"
                      href={commitUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sha}
                    </a>
                    {entry.author?.name ? (
                      <span className="min-w-0 truncate">
                        <span className="text-foreground/80">
                          {entry.author.name}
                        </span>
                        {entry.author.login &&
                        entry.author.login !== entry.author.name ? (
                          <span className="text-subtle-foreground">
                            {' '}
                            @{entry.author.login}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    <span aria-hidden className="text-subtle-foreground">
                      ·
                    </span>
                    <time dateTime={entry.commitTimestamp}>
                      {formattedDate}
                    </time>
                  </div>
                </div>

                <div className="flex flex-none flex-wrap items-center gap-2">
                  {isFailure ? (
                    <InspectPromptButton
                      copyStatus={
                        copyState?.sha === entry.commitSha
                          ? copyState.status
                          : null
                      }
                      stackLabel={stackLabel ?? null}
                      onClick={() => handleCopyPrompt(entry)}
                    />
                  ) : null}
                  <a
                    href={entry.workflowRunUrl}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Workflow
                    <ArrowUpRight aria-hidden className="size-3.5" />
                  </a>
                  {entry.overallStatus === 'success' ? (
                    <span className="sr-only">{commitStyles.label}</span>
                  ) : (
                    <Badge variant={commitStyles.badge}>
                      {commitStyles.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'mt-3 flex flex-col gap-2',
                avatarUrl && 'sm:pl-10',
              )}
            >
              {issueSuites.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {issueSuites.map((suite) => {
                    const styles =
                      suite.status === 'cancelled'
                        ? issueSuiteStyles.cancelled
                        : issueSuiteStyles.failure;
                    const StatusIcon = styles.icon;
                    const durationLabel = formatDuration(suite.durationMs);
                    return (
                      <li key={suite.name} className="min-w-0">
                        <a
                          href={suite.logUrl ?? entry.workflowRunUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150',
                            styles.container,
                          )}
                        >
                          <StatusIcon
                            aria-hidden
                            className={cn(
                              'size-3.5 shrink-0',
                              styles.iconClass,
                            )}
                          />
                          <span className="truncate">{suite.name}</span>
                          <span className="sr-only">{styles.label}</span>
                          {durationLabel ? (
                            <span className="font-mono text-[11px] font-normal opacity-60">
                              {durationLabel}
                            </span>
                          ) : null}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {passedSuites.length > 0 ? (
                <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                  {passedSuites.map((suite) => {
                    const durationLabel = formatDuration(suite.durationMs);
                    return (
                      <li key={suite.name} className="min-w-0">
                        <a
                          href={suite.logUrl ?? entry.workflowRunUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={
                            durationLabel
                              ? `${suite.name}: passed in ${durationLabel}`
                              : `${suite.name}: passed`
                          }
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        >
                          <Check
                            aria-hidden
                            className="size-3 shrink-0 text-emerald-400/80"
                          />
                          {suite.name}
                          <span className="sr-only">Passed</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </article>
        </div>
      );
    },
    [handleCopyPrompt, copyState, selectedStackMeta, highlightedSha],
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 sm:w-56">
          <label htmlFor="suite-filter" className="sr-only">
            Suite
          </label>
          <Select value={selectedSuite} onValueChange={setSelectedSuite}>
            <SelectTrigger id="suite-filter">
              <SelectValue placeholder="Select suite…">
                <span className="text-muted-foreground">Suite:</span>{' '}
                {selectedSuite === 'all' ? 'All' : selectedSuite}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suites</SelectItem>
              {allSuiteNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor="commit-search" className="sr-only">
            Search
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
            />
            <input
              id="commit-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Commit, author, suite…"
              className="h-10 w-full rounded-lg border border-border bg-white/[0.03] pr-3 pl-9 text-sm text-foreground transition-[border-color,background-color,box-shadow] duration-150 outline-hidden placeholder:text-subtle-foreground hover:border-border-strong focus:border-border-strong focus:bg-white/[0.05] focus:ring-2 focus:ring-cyan-400/40"
            />
          </div>
        </div>
      </div>

      {filteredEntries.length > 0 ? (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            }}
          >
            {virtualItems.map((virtualRow) => {
              const entry = filteredEntries[virtualRow.index];
              return (
                <div
                  key={entry.commitSha}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                >
                  {renderEntry(entry)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong px-8 py-16 text-center">
          <SearchX aria-hidden className="size-6 text-subtle-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">No runs found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another stack, suite, or search term.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
