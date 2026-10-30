import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { apiFetch, getNativeApiOrigin } from "./lib/api-fetch";
import { NativeConnectionGate } from "./components/NativeConnectionGate";
import ReminderSync from "./components/ReminderSync";

const queryClient = new QueryClient();
// A browser history restoration must re-establish the current HttpOnly session;
// it must not treat a paused page's private query results as current identity.
window.addEventListener("pageshow", event => {
  if (event.persisted) void queryClient.resetQueries();
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Display errors in the owning screen. Never log request/error objects:
    // authentication and medication-related failures can contain private data.
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getNativeApiOrigin() ?? ""}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return apiFetch(input, init);
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <NativeConnectionGate>
        <ReminderSync />
        <App />
      </NativeConnectionGate>
    </QueryClientProvider>
  </trpc.Provider>
);
