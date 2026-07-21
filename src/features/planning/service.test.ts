import { describe, expect, it } from "vitest";

import { buildPlanningInput } from "./prompt";
import { planRequestSchema } from "./schema";

describe("buildPlanningInput", () => {
  it("includes structured contributor ideas and attribution in the planner prompt", () => {
    const input = buildPlanningInput(planRequestSchema.parse({
      repository: "acme/product",
      goal: "Build a product planning experience for engineering teams.",
      contributorIdeas: [{
        ideaId: "idea-1",
        contributorId: "human-1",
        contributorName: "Teju",
        title: "Evidence-first review",
        detail: "Make review decisions visible alongside the plan.",
        status: "accepted",
      }],
    }));

    expect(input).toContain("Structured contributor ideas to consider:");
    expect(input).toContain('"contributorName": "Teju"');
    expect(input).toContain('"title": "Evidence-first review"');
    expect(input).toContain("must be considered");
  });
});
