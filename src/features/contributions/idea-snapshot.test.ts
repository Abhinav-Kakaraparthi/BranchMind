import { describe, expect, it } from "vitest";

import { createContributorIdeaSnapshot, createPlanningRequest } from "./idea-snapshot";
import { emptyContributionLedger } from "./schema";

const createdAt = "2026-07-21T12:00:00.000Z";

function ledger() {
  return {
    ...emptyContributionLedger(),
    contributors: [{ id: "human-1", name: "Teju", createdAt }],
    ideas: [
      { id: "idea-1", contributorId: "human-1", title: "Accessible setup", detail: "Guide users through first-run setup.", status: "proposed" as const, createdAt },
      { id: "idea-2", contributorId: "human-1", title: "Private draft", detail: "Keep planning drafts local.", status: "not-selected" as const, createdAt },
      { id: "idea-3", contributorId: "human-1", title: "Shared review", detail: "Make review evidence easy to inspect.", status: "blended" as const, createdAt },
    ],
  };
}

describe("createContributorIdeaSnapshot", () => {
  it("preserves contributor attribution for every included idea", () => {
    expect(createContributorIdeaSnapshot(ledger())).toEqual([
      { ideaId: "idea-1", contributorId: "human-1", contributorName: "Teju", title: "Accessible setup", detail: "Guide users through first-run setup.", status: "proposed" },
      { ideaId: "idea-3", contributorId: "human-1", contributorName: "Teju", title: "Shared review", detail: "Make review evidence easy to inspect.", status: "blended" },
    ]);
  });

  it("excludes not-selected ideas from the immutable planning request snapshot", () => {
    const request = createPlanningRequest(" acme/product ", "Build a clear product planning experience.", ledger());

    expect(request.repository).toBe("acme/product");
    expect(request.contributorIdeas.map((idea) => idea.ideaId)).toEqual(["idea-1", "idea-3"]);
    expect(request.contributorIdeas.some((idea) => idea.title === "Private draft")).toBe(false);
  });
});
