import type { Db } from "./client";
import { posts, sites } from "./schema";

const SEED_SITES = [
  { name: "Acme Blog", slug: "acme", deployHookUrl: "https://hooks.example.invalid/deploy/acme" },
  {
    name: "Northwind Notes",
    slug: "northwind",
    deployHookUrl: "https://hooks.example.invalid/deploy/northwind",
  },
  {
    name: "Contoso Digest",
    slug: "contoso",
    deployHookUrl: "https://hooks.example.invalid/deploy/contoso",
  },
] as const;

/**
 * Populates a handful of demo sites and posts, but only against an empty
 * database — safe to call on every startup. There's no admin flow to create
 * a site in this cut of the product, so a fresh checkout needs *something*
 * to look at.
 */
export async function seedIfEmpty(db: Db): Promise<void> {
  const existing = await db.select({ id: sites.id }).from(sites).limit(1);
  if (existing.length > 0) return;

  for (const site of SEED_SITES) {
    const [inserted] = await db.insert(sites).values(site).returning();
    if (!inserted) continue;
    await db.insert(posts).values(samplePostsFor(inserted.id, site.name));
  }
}

function samplePostsFor(siteId: number, siteName: string) {
  return [
    {
      siteId,
      title: `Welcome to ${siteName}`,
      slug: "welcome",
      body: `This is the first post on ${siteName}. Edit it, or write a new one.`,
      status: "published" as const,
    },
    {
      siteId,
      title: "A post still in progress",
      slug: "a-post-still-in-progress",
      body: "Nothing published here yet — this draft hasn't been sent out.",
      status: "draft" as const,
    },
  ];
}
