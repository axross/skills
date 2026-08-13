import { describe, expect, it } from "vitest";
import { getPostListQueryOptions } from "./post-list-query";
import { getPostQueryOptions } from "./post-query";

describe("getPostListQueryOptions", () => {
  it("scopes the key under the site slug", () => {
    expect(getPostListQueryOptions("acme").queryKey).toEqual(["sites", "acme", "posts"]);
  });

  it("keys two different sites' post lists separately", () => {
    const acme = getPostListQueryOptions("acme").queryKey;
    const northwind = getPostListQueryOptions("northwind").queryKey;

    expect(acme).not.toEqual(northwind);
  });
});

describe("getPostQueryOptions", () => {
  it("does not collide with another site's post carrying the same id", () => {
    const acmePost = getPostQueryOptions("acme", 1).queryKey;
    const northwindPost = getPostQueryOptions("northwind", 1).queryKey;

    expect(acmePost).not.toEqual(northwindPost);
  });
});
