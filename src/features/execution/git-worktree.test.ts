import { describe, expect, it } from "vitest";

import { assertSafeGitRef } from "./git-worktree";

describe("assertSafeGitRef", () => {
  it.each([
    "main",
    "agent/context-compiler",
    "feature/reviewer-agent",
  ])("accepts safe Git reference %s", (reference) => {
    expect(() => assertSafeGitRef(reference)).not.toThrow();
  });

  it.each([
    "",
    "../main",
    "agent//unsafe",
    "agent/@{unsafe}",
    "agent\\unsafe",
    "agent/unsafe.",
  ])("rejects unsafe Git reference %s", (reference) => {
    expect(() => assertSafeGitRef(reference)).toThrow(
      "Unsafe Git reference",
    );
  });
});
