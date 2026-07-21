import { describe, expect, it } from "vitest";

import type { TeamExecutionResponse } from "@/features/execution/team-request";

import { emptyContributionLedger, type ContributionLedger } from "./schema";
import { largestRemainderAllocate, scoreContributionLedger } from "./scoring";

const createdAt = "2026-07-21T12:00:00.000Z";

function ledger(): ContributionLedger {
  return {
    ...emptyContributionLedger(),
    contributors: [
      { id: "human-1", name: "Abhi", createdAt },
      { id: "human-2", name: "Teju", createdAt },
    ],
  };
}

function completedTeam(): TeamExecutionResponse {
  return {
    concurrency: 2,
    branches: [],
    agents: [{
      key: "ledger-ui",
      status: "completed",
      value: {
        branchName: "agent/ledger-ui",
        changedFiles: ["src/features/contributions/contribution-ledger.tsx"],
        pullRequestUrl: "https://github.com/acme/branchmind/pull/42",
        qualityGates: [{ command: "npm test", passed: true }],
      },
    }],
  };
}

describe("scoreContributionLedger", () => {
  it("places every pool in Unattributed when there is no qualifying evidence", () => {
    const credits = scoreContributionLedger(ledger());

    expect(credits).toEqual([expect.objectContaining({
      recipientName: "Unattributed",
      percent: 100,
    })]);
  });

  it("credits accepted and blended human ideas, not merely proposed ideas", () => {
    const input = ledger();
    input.ideas = [
      { id: "idea-1", contributorId: "human-1", title: "Accepted", detail: "A", status: "accepted", createdAt },
      { id: "idea-2", contributorId: "human-2", title: "Blended", detail: "B", status: "blended", createdAt },
      { id: "idea-3", contributorId: "human-1", title: "Draft", detail: "C", status: "proposed", createdAt },
    ];

    const credits = scoreContributionLedger(input);

    expect(credits.find((item) => item.recipientName === "Abhi")?.percent).toBe(18);
    expect(credits.find((item) => item.recipientName === "Teju")?.percent).toBe(17);
  });

  it("credits evidenced review and integration events to their human recorders", () => {
    const input = ledger();
    input.ideas = [{ id: "idea-1", contributorId: "human-1", title: "Chosen", detail: "A", status: "accepted", createdAt }];
    input.reviews = [{ id: "review-1", contributorId: "human-2", summary: "Verified acceptance criteria", workstreamKey: "ledger-ui", createdAt }];
    input.decisions = [{ id: "decision-1", contributorId: "human-1", selectedIdeaId: "idea-1", rationale: "Fits the accepted scope", pullRequestUrl: "https://github.com/acme/branchmind/pull/42", createdAt }];

    const credits = scoreContributionLedger(input);

    expect(credits.find((item) => item.recipientName === "Abhi")?.percent).toBe(45);
    expect(credits.find((item) => item.recipientName === "Teju")?.percent).toBe(15);
  });

  it("assigns implementation credit only to Agent team when a real execution completed", () => {
    const credits = scoreContributionLedger(ledger(), completedTeam());
    const agentCredit = credits.find((item) => item.recipientName === "Agent team");

    expect(agentCredit?.percent).toBe(40);
    expect(agentCredit?.evidence[0].label).toContain("https://github.com/acme/branchmind/pull/42");
  });

  it("totals exactly 100 percent after integer rounding", () => {
    const input = ledger();
    input.ideas = [
      { id: "idea-1", contributorId: "human-1", title: "A", detail: "A", status: "accepted", createdAt },
      { id: "idea-2", contributorId: "human-2", title: "B", detail: "B", status: "blended", createdAt },
      { id: "idea-3", contributorId: "human-2", title: "C", detail: "C", status: "accepted", createdAt },
    ];
    input.reviews = [{ id: "review-1", contributorId: "human-1", summary: "Reviewed", workstreamKey: "ledger-ui", createdAt }];
    input.decisions = [{ id: "decision-1", contributorId: "human-2", combinedIdeaIds: ["idea-1", "idea-2"], rationale: "Combined", workstreamKey: "ledger-ui", createdAt }];

    expect(scoreContributionLedger(input, completedTeam()).reduce((total, item) => total + item.percent, 0)).toBe(100);
  });

  it("uses stable recipient IDs to resolve largest-remainder ties", () => {
    const events = [
      { recipientId: "human-2", evidence: { id: "two", label: "two" } },
      { recipientId: "human-1", evidence: { id: "one", label: "one" } },
    ];

    expect(largestRemainderAllocate(35, events)).toEqual(new Map([
      ["human-1", 18],
      ["human-2", 17],
    ]));
  });
});
