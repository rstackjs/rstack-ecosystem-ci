import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import App from '@/App';

// Serialize one clock value so the server and hydration render agree.
const getRenderTime = createServerFn({ method: 'GET' }).handler(() =>
  Date.now(),
);

export const Route = createFileRoute('/')({
  loader: () => getRenderTime(),
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
