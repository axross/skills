import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Button } from "../components/Button/Button";
import { PublishToast } from "../components/PublishToast/PublishToast";
import { trackEvent } from "../lib/analytics";
import { getPostPublishMutationOptions } from "../queries/posts/post-publish-mutation";
import { getPostQueryOptions } from "../queries/posts/post-query";
import { getPostSaveMutationOptions } from "../queries/posts/post-save-mutation";
import { rootLogger } from "../../shared/logger";
import type { Post } from "../types";
import css from "./PostEditorPage.module.css";

const logger = rootLogger.child("post-editor");

interface ToastState {
  readonly tone: "success" | "error";
  readonly message: string;
}

export function PostEditorPage() {
  const { siteSlug = "", postId: postIdParam = "" } = useParams();
  const postId = Number(postIdParam);
  const postQuery = useQuery(getPostQueryOptions(siteSlug, postId));

  if (postQuery.isPending) return <p>Loading post…</p>;
  if (postQuery.isError) return <p role="alert">Couldn't load this post.</p>;

  // Keyed by the post's own id, so navigating straight from one post to
  // another remounts the form with that post's own content instead of
  // syncing local state to it through an effect.
  return (
    <PostEditorForm
      key={postQuery.data.id}
      siteSlug={siteSlug}
      postId={postId}
      post={postQuery.data}
    />
  );
}

function PostEditorForm({
  siteSlug,
  postId,
  post,
}: Readonly<{ siteSlug: string; postId: number; post: Post }>) {
  const saveMutation = useMutation(getPostSaveMutationOptions(siteSlug, postId));
  const publishMutation = useMutation(getPostPublishMutationOptions(siteSlug, postId));

  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleSaveDraft() {
    saveMutation.mutate(
      { title, body },
      { onSuccess: () => trackEvent("draft saved", { site_slug: siteSlug, post_id: postId }) },
    );
  }

  function handlePublish() {
    publishMutation.mutate(undefined, {
      onSuccess: (result) => {
        trackEvent("post published", { site_slug: siteSlug, post_id: postId });
        setToast(
          result.deployTriggered
            ? { tone: "success", message: "Published. The site will rebuild shortly." }
            : {
                tone: "error",
                message:
                  "Published, but the deploy didn't fire — you may need to trigger it yourself.",
              },
        );
      },
      onError: () => {
        logger.warn(
          { siteSlug, postId },
          "A publish request failed; the editor will let the author retry.",
        );
        setToast({ tone: "error", message: "Publishing failed. Try again." });
      },
    });
  }

  return (
    <section className={css.editor}>
      <p className={css.status}>Status: {post.status}</p>

      <label className={css.field}>
        <span className={css.label}>Title</span>
        <input
          className={css.titleInput}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className={css.field}>
        <span className={css.label}>Body</span>
        <textarea
          className={css.bodyInput}
          rows={16}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <div className={css.actions}>
        <Button
          variant="secondary"
          loading={saveMutation.isPending}
          error={saveMutation.isError}
          onClick={handleSaveDraft}
        >
          {saveMutation.isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          loading={publishMutation.isPending}
          error={publishMutation.isError}
          onClick={handlePublish}
        >
          {publishMutation.isPending ? "Publishing…" : "Publish"}
        </Button>
      </div>

      {toast && <PublishToast tone={toast.tone} message={toast.message} />}
    </section>
  );
}
