import type { PlanRequest } from "@/features/planning/schema";

import type { ContributionLedger } from "./schema";

export function createContributorIdeaSnapshot(
  ledger: ContributionLedger,
): PlanRequest["contributorIdeas"] {
  const contributors = new Map(
    ledger.contributors.map((contributor) => [contributor.id, contributor.name]),
  );

  return ledger.ideas.flatMap((idea) => {
    if (idea.status === "not-selected") return [];

    const contributorName = contributors.get(idea.contributorId);
    if (!contributorName) return [];

    return [{
      ideaId: idea.id,
      contributorId: idea.contributorId,
      contributorName,
      title: idea.title,
      detail: idea.detail,
      status: idea.status,
    }];
  });
}

export function createPlanningRequest(
  repository: string,
  goal: string,
  ledger: ContributionLedger,
): PlanRequest {
  return {
    repository: repository.trim(),
    goal: goal.trim(),
    contributorIdeas: createContributorIdeaSnapshot(ledger),
  };
}
