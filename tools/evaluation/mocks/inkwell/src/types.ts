export interface Site {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly deployHookUrl: string;
}

export interface Author {
  readonly id: string;
  readonly name: string;
  readonly siteCount: number;
}

export type PostStatus = "draft" | "published";

export interface Post {
  readonly id: number;
  readonly siteId: number;
  readonly title: string;
  readonly slug: string;
  readonly body: string;
  readonly status: PostStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavePostInput {
  readonly title: string;
  readonly body: string;
}

export interface PublishResult {
  readonly post: Post;
  readonly deployTriggered: boolean;
}

/** A snapshot of what a post said when it was published, with the post it belongs to. */
export interface Revision {
  readonly id: number;
  readonly postId: number;
  readonly postTitle: string;
  readonly title: string;
  readonly createdAt: string;
}
