import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./index.css";
import { wagmiConfig } from "./lib/wagmi";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";

const Cover = lazy(() => import("./pages/Cover"));
const Underwrite = lazy(() => import("./pages/Underwrite"));
const Claims = lazy(() => import("./pages/Claims"));
const Replay = lazy(() => import("./pages/Replay"));
const Proof = lazy(() => import("./pages/Proof"));

// After a redeploy, an open tab may request page chunks that no longer exist. Reload once to
// pick up the current build instead of failing.
window.addEventListener("vite:preloadError", () => {
  const key = "backstop:reloaded-for-chunk";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
});

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 8_000 } } });

function Loading() {
  return <div className="mx-auto max-w-6xl px-6 py-24 text-dim">Loading…</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Layout>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/cover" element={<Cover />} />
                <Route path="/underwrite" element={<Underwrite />} />
                <Route path="/claims" element={<Claims />} />
                <Route path="/replay" element={<Replay />} />
                <Route path="/proof" element={<Proof />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </Layout>
        </HashRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
