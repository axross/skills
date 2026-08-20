import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { ConsentBanner } from "./components/ConsentBanner/ConsentBanner";
import { ConsentProvider } from "./lib/consent";
import { queryClient } from "./lib/queryClient";
import { Layout } from "./routes/Layout";
import { PostEditorPage } from "./routes/PostEditorPage";
import { PostListPage } from "./routes/PostListPage";
import { RevisionsPage } from "./routes/RevisionsPage";
import { RootRedirect } from "./routes/RootRedirect";

// A section per sidebar entry, plus the post editor under the post list and
// the root path that only ever redirects into the first of them.
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/sites/:siteSlug/posts" element={<PostListPage />} />
              <Route path="/sites/:siteSlug/posts/:postId" element={<PostEditorPage />} />
              <Route path="/sites/:siteSlug/revisions" element={<RevisionsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <ConsentBanner />
      </ConsentProvider>
    </QueryClientProvider>
  );
}
