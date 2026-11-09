import { createFileRoute } from '@tanstack/react-router';
import App from '@/App';
import loadHistory from '@/data/history';

export const Route = createFileRoute('/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    stack?: string;
    suite?: string;
  } => ({
    stack: typeof search.stack === 'string' ? search.stack : undefined,
    suite: typeof search.suite === 'string' ? search.suite : undefined,
  }),
  loader: async ({ abortController }) => ({
    history: await loadHistory(abortController.signal),
    loadedAt: new Date().toISOString(),
  }),
  // Stack and suite changes filter the same snapshot without downloading it again.
  staleTime: Infinity,
  component: App,
  errorComponent: () => (
    <main id="main-content" className="px-4 py-14 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Unable to load CI history</h1>
      <p className="mb-4 text-muted-foreground">
        Please try again in a moment.
      </p>
      <button
        type="button"
        className="underline"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </main>
  ),
});
