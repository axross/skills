export interface Site {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly deployHookUrl: string;
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
