import { describe, expect, it } from "vitest";

import { contributionLedgerSchema, emptyContributionLedger } from "./schema";
import {
  clearContributionLedger,
  contributionLedgerStorageKey,
  getServerContributionLedgerSnapshot,
  loadContributionLedger,
  saveContributionLedger,
  subscribeToContributionLedger,
} from "./storage";

describe("contributionLedgerStorageKey", () => {
  it("is repository-scoped, normalized, and versioned", () => {
    expect(contributionLedgerStorageKey(" Abhinav-Kakaraparthi/BranchMind ")).toBe(
      "branchmind:contribution-ledger:v1:abhinav-kakaraparthi/branchmind",
    );
  });

  it("accepts persisted review and integration evidence", () => {
    expect(contributionLedgerSchema.parse({
      ...emptyContributionLedger(),
      contributors: [{ id: "human-1", name: "Abhi", createdAt: "2026-07-21T12:00:00.000Z" }],
      ideas: [{ id: "idea-1", contributorId: "human-1", title: "A", detail: "A", status: "accepted", createdAt: "2026-07-21T12:00:00.000Z" }],
      reviews: [{ id: "review-1", contributorId: "human-1", summary: "Reviewed", workstreamKey: "ledger-ui", createdAt: "2026-07-21T12:00:00.000Z" }],
      decisions: [{ id: "decision-1", contributorId: "human-1", selectedIdeaId: "idea-1", rationale: "Selected", pullRequestUrl: "https://github.com/acme/branchmind/pull/42", createdAt: "2026-07-21T12:00:00.000Z" }],
    })).toMatchObject({ version: 1 });
  });

  it("returns the same snapshot while a repository value is unchanged", () => {
    withFakeWindow(() => {
      expect(loadContributionLedger("acme/stable")).toBe(loadContributionLedger("acme/stable"));
    });
  });

  it("replaces a repository snapshot after saving", () => {
    withFakeWindow(() => {
      const before = loadContributionLedger("acme/changed");
      saveContributionLedger("acme/changed", ledgerFor("Teju"));
      const after = loadContributionLedger("acme/changed");

      expect(after).not.toBe(before);
      expect(after.contributors[0]?.name).toBe("Teju");
    });
  });

  it("keeps independent snapshots for different repositories", () => {
    withFakeWindow(() => {
      const repositoryB = loadContributionLedger("acme/repository-b");
      saveContributionLedger("acme/repository-a", ledgerFor("Abhi"));

      expect(loadContributionLedger("acme/repository-a").contributors[0]?.name).toBe("Abhi");
      expect(loadContributionLedger("acme/repository-b")).toBe(repositoryB);
      expect(loadContributionLedger("acme/repository-b").contributors).toHaveLength(0);
    });
  });

  it("notifies subscribers in the same browser window after a ledger write", () => {
    withFakeWindow(() => {
      const received: string[] = [];
      const unsubscribe = subscribeToContributionLedger("acme/product", () => {
        received.push(loadContributionLedger("acme/product").contributors[0]?.name ?? "");
      });

      saveContributionLedger("acme/product", ledgerFor("Teju"));

      unsubscribe();
      expect(received).toEqual(["Teju"]);
    });
  });

  it("updates the cached snapshot before notifying subscribers about a clear", () => {
    withFakeWindow(() => {
      saveContributionLedger("acme/clear", ledgerFor("Teju"));
      const before = loadContributionLedger("acme/clear");
      const received: string[] = [];
      const unsubscribe = subscribeToContributionLedger("acme/clear", () => {
        received.push(loadContributionLedger("acme/clear").contributors[0]?.name ?? "empty");
      });

      clearContributionLedger("acme/clear");

      unsubscribe();
      expect(loadContributionLedger("acme/clear")).not.toBe(before);
      expect(received).toEqual(["empty"]);
    });
  });

  it("refreshes a repository snapshot after a browser storage event", () => {
    withFakeWindow((values, fakeWindow) => {
      const repository = "acme/other-tab";
      const key = contributionLedgerStorageKey(repository);
      const before = loadContributionLedger(repository);
      values.set(key, JSON.stringify(ledgerFor("Abhi")));
      const received: string[] = [];
      const unsubscribe = subscribeToContributionLedger(repository, () => {
        received.push(loadContributionLedger(repository).contributors[0]?.name ?? "");
      });

      fakeWindow.dispatchEvent(Object.assign(new Event("storage"), { key }));

      unsubscribe();
      expect(loadContributionLedger(repository)).not.toBe(before);
      expect(received).toEqual(["Abhi"]);
    });
  });

  it("returns one immutable server snapshot", () => {
    const first = getServerContributionLedgerSnapshot();
    const second = getServerContributionLedgerSnapshot();

    expect(first).toBe(second);
    expect(loadContributionLedger("acme/server")).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.contributors)).toBe(true);
  });
});

function ledgerFor(name: string) {
  return {
    ...emptyContributionLedger(),
    contributors: [{ id: "human-1", name, createdAt: "2026-07-21T12:00:00.000Z" }],
  };
}

function withFakeWindow(run: (values: Map<string, string>, fakeWindow: Window) => void) {
  const originalWindow = globalThis.window;
  const values = new Map<string, string>();
  const fakeWindow = new EventTarget() as Window;
  Object.assign(fakeWindow, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  try {
    run(values, fakeWindow);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
}
