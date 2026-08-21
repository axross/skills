import type { Author, Post, PublishResult, Revision, SavePostInput, Site } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || response.statusText);
  }

  return (await response.json()) as T;
}

export const api = {
  getAuthor: () => request<Author>("/me"),
  listSites: () => request<Site[]>("/sites"),
  listRevisions: (siteSlug: string) => request<Revision[]>(`/sites/${siteSlug}/revisions`),
  listPosts: (siteSlug: string) => request<Post[]>(`/sites/${siteSlug}/posts`),
  getPost: (siteSlug: string, postId: number) =>
    request<Post>(`/sites/${siteSlug}/posts/${postId}`),
  savePost: (siteSlug: string, postId: number, input: SavePostInput) =>
    request<Post>(`/sites/${siteSlug}/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  publishPost: (siteSlug: string, postId: number) =>
    request<PublishResult>(`/sites/${siteSlug}/posts/${postId}/publish`, { method: "POST" }),
};
