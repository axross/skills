import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createDb, type Db } from "./db/client";
import { posts, sites } from "./db/schema";

let db: Db;
let app: ReturnType<typeof createApp>;

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  // The publish route below calls the site's deploy hook for real. Stubbing
  // `fetch` keeps this suite off the network — see deploy-hook.test.ts for
  // that call's own retry behaviour, which this suite doesn't re-test.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

  db = createDb(":memory:");
  await migrate(db, { migrationsFolder: "./server/db/migrations" });

  const [acme] = await db
    .insert(sites)
    .values({
      name: "Acme Blog",
      slug: "acme",
      deployHookUrl: "https://hooks.example.invalid/acme",
    })
    .returning();
  if (!acme) throw new Error("expected a seeded site");
  await db
    .insert(posts)
    .values({ siteId: acme.id, title: "Hello", slug: "hello", body: "First post." });

  app = createApp(db);
});

describe("GET /sites", () => {
  it("lists every seeded site", async () => {
    const response = await app.request("/sites");

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ slug: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.slug).toBe("acme");
  });
});

describe("GET /sites/:siteSlug/posts", () => {
  it("lists a site's own posts", async () => {
    const response = await app.request("/sites/acme/posts");

    const body = (await response.json()) as Array<{ title: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.title).toBe("Hello");
  });

  it("404s for a site that does not exist", async () => {
    const response = await app.request("/sites/does-not-exist/posts");

    expect(response.status).toBe(404);
  });
});

describe("PUT /sites/:siteSlug/posts/:postId", () => {
  it("saves a title and body edit", async () => {
    const response = await app.request("/sites/acme/posts/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello, edited", body: "Updated body." }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { title: string };
    expect(body.title).toBe("Hello, edited");
  });

  it("rejects a save missing a body field", async () => {
    const response = await app.request("/sites/acme/posts/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello, edited" }),
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /sites/:siteSlug/posts/:postId/publish", () => {
  it("marks the post published and reports whether the deploy hook fired", async () => {
    const response = await app.request("/sites/acme/posts/1/publish", { method: "POST" });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: { status: string }; deployTriggered: boolean };
    expect(body.post.status).toBe("published");
    expect(typeof body.deployTriggered).toBe("boolean");
  });
});
