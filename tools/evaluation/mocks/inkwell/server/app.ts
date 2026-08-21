import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { rootLogger } from "../shared/logger";
import type { Db } from "./db/client";
import { posts, revisions, sites } from "./db/schema";
import { triggerDeployHook } from "./deploy-hook";

const logger = rootLogger.child("api");

const DEVELOPMENT_AUTHOR = { id: "author_dev", name: "Local Developer" };

interface SavePostBody {
  readonly title?: unknown;
  readonly body?: unknown;
}

function isSavePostBody(value: unknown): value is { title: string; body: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as SavePostBody;
  return typeof candidate.title === "string" && typeof candidate.body === "string";
}

/**
 * Builds the API against a given database rather than reaching for a module-
 * level singleton, so a test can pass an in-memory one and never touch the
 * file the running server uses. server/index.ts is the only caller that
 * passes a real, file-backed `Db`.
 */
export function createApp(db: Db) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  // Whatever fronts the console authenticates the author and forwards who
  // they are; this app never sees a credential. Running the API on its own —
  // `npm run dev:api`, or a test — there is no proxy in front of it, so the
  // development author below stands in rather than the route failing.
  app.get("/me", async (c) => {
    const [counted] = await db.select({ sites: count() }).from(sites);

    return c.json({
      id: c.req.header("x-forwarded-user") ?? DEVELOPMENT_AUTHOR.id,
      name: c.req.header("x-forwarded-user-name") ?? DEVELOPMENT_AUTHOR.name,
      siteCount: counted?.sites ?? 0,
    });
  });

  app.get("/sites", async (c) => {
    const rows = await db.select().from(sites);
    return c.json(rows);
  });

  app.get("/sites/:siteSlug/posts", async (c) => {
    const site = await findSiteBySlug(db, c.req.param("siteSlug"));
    if (!site) return c.json({ error: "Site not found." }, 404);

    const rows = await db.select().from(posts).where(eq(posts.siteId, site.id));
    return c.json(rows);
  });

  app.get("/sites/:siteSlug/posts/:postId", async (c) => {
    const site = await findSiteBySlug(db, c.req.param("siteSlug"));
    if (!site) return c.json({ error: "Site not found." }, 404);

    const post = await findSitePost(db, site.id, c.req.param("postId"));
    if (!post) return c.json({ error: "Post not found." }, 404);

    return c.json(post);
  });

  // Every publish writes a revision; this is where an author reads them back.
  // The post's current title comes along so the screen can group snapshots
  // under the post they belong to without a request per row. Ordering falls
  // back to the id because `created_at` only resolves to the second, and two
  // publishes within the same second are ordinary.
  app.get("/sites/:siteSlug/revisions", async (c) => {
    const site = await findSiteBySlug(db, c.req.param("siteSlug"));
    if (!site) return c.json({ error: "Site not found." }, 404);

    const rows = await db
      .select({
        id: revisions.id,
        postId: revisions.postId,
        postTitle: posts.title,
        title: revisions.title,
        createdAt: revisions.createdAt,
      })
      .from(revisions)
      .innerJoin(posts, eq(revisions.postId, posts.id))
      .where(eq(posts.siteId, site.id))
      .orderBy(desc(revisions.createdAt), desc(revisions.id));

    return c.json(rows);
  });

  app.put("/sites/:siteSlug/posts/:postId", async (c) => {
    const site = await findSiteBySlug(db, c.req.param("siteSlug"));
    if (!site) return c.json({ error: "Site not found." }, 404);

    const post = await findSitePost(db, site.id, c.req.param("postId"));
    if (!post) return c.json({ error: "Post not found." }, 404);

    const body = await c.req.json().catch(() => null);
    if (!isSavePostBody(body)) {
      return c.json({ error: "A draft save needs a title and a body, both strings." }, 400);
    }

    const [updated] = await db
      .update(posts)
      .set({ title: body.title, body: body.body, updatedAt: new Date().toISOString() })
      .where(eq(posts.id, post.id))
      .returning();

    return c.json(updated);
  });

  // Publishing writes a revision snapshot, flips the post to "published",
  // and calls the site's deploy hook — see docs/deploy-hooks.md for what
  // happens when that last step fails.
  app.post("/sites/:siteSlug/posts/:postId/publish", async (c) => {
    const site = await findSiteBySlug(db, c.req.param("siteSlug"));
    if (!site) return c.json({ error: "Site not found." }, 404);

    const post = await findSitePost(db, site.id, c.req.param("postId"));
    if (!post) return c.json({ error: "Post not found." }, 404);

    // One write, not two: a revision row for a post that never flipped to
    // published is a snapshot of something the site never served. The
    // callback is synchronous because this driver is — an async one would let
    // the transaction commit before the work inside it had finished.
    const updated = db.transaction((tx) => {
      tx.insert(revisions).values({ postId: post.id, title: post.title, body: post.body }).run();
      const [row] = tx
        .update(posts)
        .set({ status: "published", updatedAt: new Date().toISOString() })
        .where(eq(posts.id, post.id))
        .returning()
        .all();
      return row;
    });

    logger.info({ siteSlug: site.slug, postId: post.id }, "Started publishing a post.");
    const deployResult = await triggerDeployHook(site.slug, site.deployHookUrl);
    logger.info(
      { siteSlug: site.slug, postId: post.id, deployTriggered: deployResult.ok },
      "Completed publishing a post.",
    );

    return c.json({ post: updated, deployTriggered: deployResult.ok });
  });

  return app;
}

async function findSiteBySlug(db: Db, slug: string) {
  const [site] = await db.select().from(sites).where(eq(sites.slug, slug));
  return site;
}

async function findSitePost(db: Db, siteId: number, postIdParam: string) {
  const postId = Number(postIdParam);
  if (!Number.isInteger(postId)) return undefined;

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.siteId, siteId)));
  return post;
}
