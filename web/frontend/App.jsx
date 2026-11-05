import { QueryClient, QueryClientProvider } from "react-query";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // A rejected request won't succeed on retry. Network and server errors might.
      retry: (failures, error) => failures < 2 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
