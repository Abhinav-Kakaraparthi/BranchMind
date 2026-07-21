import type { TeamExecutionResponse } from "@/features/execution/team-request";

import type { ContributionLedger } from "./schema";

export const creditPools = {
  ideas: 35,
  reviews: 15,
  decisions: 10,
  implementation: 40,
} as const;

export type CreditEvidence = { id: string; label: string };
export type CreditEntry = {
  recipientId: string;
  recipientName: string;
  percent: number;
  evidence: CreditEvidence[];
};

type CreditedEvent = { recipientId: string; evidence: CreditEvidence };

/**
 * Uses largest remainder: floor exact shares, then give remaining points to
 * highest fractional remainders; stable recipient ids break ties.
 */
export function largestRemainderAllocate(
  pool: number,
  events: CreditedEvent[],
): Map<string, number> {
  const counts = new Map<string, number>();
  events.forEach((event) =>
    counts.set(event.recipientId, (counts.get(event.recipientId) ?? 0) + 1),
  );
  const total = events.length;
  const shares = [...counts.entries()].map(([recipientId, count]) => {
    const exact = (pool * count) / total;
    return { recipientId, points: Math.floor(exact), remainder: exact % 1 };
  });
  let remaining = pool - shares.reduce((sum, share) => sum + share.points, 0);
  shares.sort(
    (left, right) =>
      right.remainder - left.remainder || left.recipientId.localeCompare(right.recipientId),
  );
  for (const share of shares) {
    if (!remaining) break;
    share.points += 1;
    remaining -= 1;
  }
  return new Map(shares.map((share) => [share.recipientId, share.points]));
}

export function scoreContributionLedger(
  ledger: ContributionLedger,
  team?: TeamExecutionResponse,
): CreditEntry[] {
  const names = new Map(ledger.contributors.map((item) => [item.id, item.name]));
  const entries = new Map<string, CreditEntry>();
  const unattributed = () => ensure(entries, "unattributed", "Unattributed");
  const addPool = (pool: number, events: CreditedEvent[], absentLabel: string) => {
    if (!events.length) {
      const entry = unattributed();
      entry.percent += pool;
      entry.evidence.push({ id: `unattributed-${absentLabel}`, label: absentLabel });
      return;
    }
    const points = largestRemainderAllocate(pool, events);
    for (const [recipientId, percent] of points) {
      const entry = ensure(
        entries,
        recipientId,
        recipientId === "agent-team" ? "Agent team" : names.get(recipientId) ?? recipientId,
      );
      entry.percent += percent;
      entry.evidence.push(...events.filter((event) => event.recipientId === recipientId).map((event) => event.evidence));
    }
  };

  addPool(
    creditPools.ideas,
    ledger.ideas
      .filter((idea) => idea.status === "accepted" || idea.status === "blended")
      .map((idea) => ({
        recipientId: idea.contributorId,
        evidence: { id: idea.id, label: `${idea.status}: ${idea.title}` },
      })),
    "No accepted or blended human ideas",
  );
  addPool(
    creditPools.reviews,
    ledger.reviews.map((review) => ({
      recipientId: review.contributorId,
      evidence: { id: review.id, label: `Review: ${review.summary}` },
    })),
    "No human review evidence",
  );
  addPool(
    creditPools.decisions,
    ledger.decisions.map((decision) => ({
      recipientId: decision.contributorId,
      evidence: { id: decision.id, label: `Integration: ${decision.rationale}` },
    })),
    "No human integration decisions",
  );
  const implementation = team?.agents
    .filter((agent) => agent.status === "completed" && agent.value)
    .map((agent) => ({
      recipientId: "agent-team",
      evidence: {
        id: `execution-${agent.key}`,
        label: `Completed ${agent.key}${agent.value?.pullRequestUrl ? `: ${agent.value.pullRequestUrl}` : ""}`,
      },
    })) ?? [];
  addPool(
    creditPools.implementation,
    implementation,
    "No completed agent execution evidence",
  );

  return [...entries.values()].sort(
    (left, right) => right.percent - left.percent || left.recipientName.localeCompare(right.recipientName),
  );
}

function ensure(
  entries: Map<string, CreditEntry>,
  recipientId: string,
  recipientName: string,
): CreditEntry {
  const current = entries.get(recipientId);
  if (current) return current;
  const created = { recipientId, recipientName, percent: 0, evidence: [] };
  entries.set(recipientId, created);
  return created;
}
