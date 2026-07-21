import {
  contributionLedgerSchema,
  emptyContributionLedger,
  emptyContributionLedgerSnapshot,
  type ContributionLedger,
} from "./schema";

export const contributionLedgerStorageVersion = 1;
export const contributionLedgerEventName = "branchmind:contribution-ledger";
const ledgerCache = new Map<string, { serialized: string | null; ledger: ContributionLedger }>();

type ContributionLedgerEventDetail = {
  repository: string;
  ledger: ContributionLedger;
};

export function contributionLedgerStorageKey(repository: string): string {
  return `branchmind:contribution-ledger:v${contributionLedgerStorageVersion}:${repository.trim().toLowerCase()}`;
}

export function getServerContributionLedgerSnapshot(): ContributionLedger {
  return emptyContributionLedgerSnapshot;
}

export function loadContributionLedger(repository: string): ContributionLedger {
  if (typeof window === "undefined") return getServerContributionLedgerSnapshot();

  const key = contributionLedgerStorageKey(repository);
  const stored = window.localStorage.getItem(key);
  const cached = ledgerCache.get(key);
  if (cached?.serialized === stored) return cached.ledger;

  try {
    const ledger = stored
      ? contributionLedgerSchema.parse(JSON.parse(stored))
      : emptyContributionLedger();
    ledgerCache.set(key, { serialized: stored, ledger });
    return ledger;
  } catch {
    const ledger = emptyContributionLedger();
    ledgerCache.set(key, { serialized: stored, ledger });
    return ledger;
  }
}

export function saveContributionLedger(
  repository: string,
  ledger: ContributionLedger,
): void {
  const validated = contributionLedgerSchema.parse(ledger);
  const key = contributionLedgerStorageKey(repository);
  const serialized = JSON.stringify(validated);
  window.localStorage.setItem(
    key,
    serialized,
  );
  ledgerCache.set(key, { serialized, ledger: validated });
  window.dispatchEvent(
    new CustomEvent<ContributionLedgerEventDetail>(contributionLedgerEventName, {
      detail: { repository: key, ledger: validated },
    }),
  );
}

export function clearContributionLedger(repository: string): void {
  const key = contributionLedgerStorageKey(repository);
  const ledger = emptyContributionLedger();

  window.localStorage.removeItem(key);
  ledgerCache.set(key, { serialized: null, ledger });
  window.dispatchEvent(
    new CustomEvent<ContributionLedgerEventDetail>(contributionLedgerEventName, {
      detail: { repository: key, ledger },
    }),
  );
}

export function subscribeToContributionLedger(
  repository: string,
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const key = contributionLedgerStorageKey(repository);
  const handleLocalUpdate = (event: Event) => {
    const detail = (event as CustomEvent<ContributionLedgerEventDetail>).detail;
    if (detail?.repository === key) listener();
  };
  const handleStorageUpdate = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      loadContributionLedger(repository);
      listener();
    }
  };

  window.addEventListener(contributionLedgerEventName, handleLocalUpdate);
  window.addEventListener("storage", handleStorageUpdate);
  return () => {
    window.removeEventListener(contributionLedgerEventName, handleLocalUpdate);
    window.removeEventListener("storage", handleStorageUpdate);
  };
}
