import { describe, expect, it } from "vitest";

import { resolveNavigationTarget } from "./navigation";

describe("resolveNavigationTarget", () => {
  it("maps every sidebar control to its own stable section", () => {
    expect(resolveNavigationTarget("overview")).toBe("overview");
    expect(resolveNavigationTarget("workstreams")).toBe("generated-workstreams");
    expect(resolveNavigationTarget("agents")).toBe("agent-team");
    expect(resolveNavigationTarget("pull-requests")).toBe("pull-request-results");
    expect(resolveNavigationTarget("contributions")).toBe("contributor-idea-board");
    expect(resolveNavigationTarget("contributions", { hasPlan: true, hasTeamResults: false })).toBe("contribution-ledger");
  });
});
