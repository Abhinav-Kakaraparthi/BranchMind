"use client";

import { useCallback, useSyncExternalStore } from "react";

import { type ContributionLedger } from "./schema";
import {
  getServerContributionLedgerSnapshot,
  loadContributionLedger,
  saveContributionLedger,
  subscribeToContributionLedger,
} from "./storage";

export function useContributionLedger(repository: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToContributionLedger(repository, onStoreChange),
    [repository],
  );
  const getSnapshot = useCallback(() => loadContributionLedger(repository), [repository]);
  const ledger = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerContributionLedgerSnapshot,
  );

  const update = useCallback(
    (transform: (current: ContributionLedger) => ContributionLedger) => {
      saveContributionLedger(repository, transform(loadContributionLedger(repository)));
    },
    [repository],
  );

  return { ledger, update };
}
