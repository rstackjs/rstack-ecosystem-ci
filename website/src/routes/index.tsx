import { createFileRoute } from '@tanstack/react-router';
import App from '@/App';

export const Route = createFileRoute('/')({
  // Loader data is serialized so the server and hydration render share one clock.
  loader: () => Date.now(),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    stack?: string;
    suite?: string;
  } => ({
    stack: typeof search.stack === 'string' ? search.stack : undefined,
    suite: typeof search.suite === 'string' ? search.suite : undefined,
  }),
  component: App,
});
