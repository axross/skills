import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { posts, revisions, sites } from "./schema";

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await migrate(db, { migrationsFolder: "./server/db/migrations" });
});

describe("the sites/posts/revisions schema", () => {
  it("round-trips a site through the generated migrations", async () => {
    const [site] = await db
      .insert(sites)
      .values({
        name: "Acme Blog",
        slug: "acme",
        deployHookUrl: "https://hooks.example.invalid/acme",
      })
      .returning();

    const found = await db.select().from(sites);

    expect(found).toHaveLength(1);
    expect(found[0]?.slug).toBe(site?.slug);
  });

  it("stores a post against its site and defaults to draft", async () => {
    const [site] = await db
      .insert(sites)
      .values({
        name: "Acme Blog",
        slug: "acme",
        deployHookUrl: "https://hooks.example.invalid/acme",
      })
      .returning();
    if (!site) throw new Error("expected a seeded site");

    const [post] = await db
      .insert(posts)
      .values({ siteId: site.id, title: "Hello", slug: "hello", body: "First post." })
      .returning();

    expect(post?.status).toBe("draft");
  });

  it("writes a revision snapshot independent of the post it came from", async () => {
    const [site] = await db
      .insert(sites)
      .values({
        name: "Acme Blog",
        slug: "acme",
        deployHookUrl: "https://hooks.example.invalid/acme",
      })
      .returning();
    if (!site) throw new Error("expected a seeded site");
    const [post] = await db
      .insert(posts)
      .values({ siteId: site.id, title: "Hello", slug: "hello", body: "First post." })
      .returning();
    if (!post) throw new Error("expected a seeded post");

    await db.insert(revisions).values({ postId: post.id, title: post.title, body: post.body });
    await db.update(posts).set({ title: "Hello, edited" }).where(eq(posts.id, post.id));

    const savedRevisions = await db.select().from(revisions);
    expect(savedRevisions).toHaveLength(1);
    expect(savedRevisions[0]?.title).toBe("Hello");
  });

  // The publish route depends on this: it writes the snapshot and flips the
  // post's status inside one transaction, and docs/deploy-hooks.md promises
  // either both happen or neither does.
  it("leaves no revision behind when the write it belongs to fails part-way", async () => {
    const [site] = await db
      .insert(sites)
      .values({
        name: "Acme Blog",
        slug: "acme",
        deployHookUrl: "https://hooks.example.invalid/acme",
      })
      .returning();
    if (!site) throw new Error("expected a seeded site");
    const [post] = await db
      .insert(posts)
      .values({ siteId: site.id, title: "Hello", slug: "hello", body: "First post." })
      .returning();
    if (!post) throw new Error("expected a seeded post");

    expect(() =>
      db.transaction((tx) => {
        tx.insert(revisions).values({ postId: post.id, title: post.title, body: post.body }).run();
        throw new Error("the status update failed");
      }),
    ).toThrow("the status update failed");

    expect(await db.select().from(revisions)).toHaveLength(0);
    const [unchanged] = await db.select().from(posts).where(eq(posts.id, post.id));
    expect(unchanged?.status).toBe("draft");
  });
});
