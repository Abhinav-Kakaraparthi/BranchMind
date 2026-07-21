"use client";

import { FormEvent, useState } from "react";
import { LightbulbIcon, UsersThreeIcon } from "@phosphor-icons/react";

import { type ContributionLedger, type ContributionStatus } from "./schema";
import { useContributionLedger } from "./use-contribution-ledger";

export const contributorIdeaBoardId = "contributor-idea-board";

const ideaStatuses: ContributionStatus[] = [
  "proposed",
  "accepted",
  "blended",
  "not-selected",
];

type ContributorIdeaBoardProps = {
  repository: string;
};

export function ContributorIdeaBoard({ repository }: ContributorIdeaBoardProps) {
  const { ledger, update } = useContributionLedger(repository);
  const [error, setError] = useState("");

  function addContributor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("contributor-name") ?? "").trim();
    if (!name) return setError("Enter a contributor name.");
    if (ledger.contributors.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
      return setError("That contributor is already in this repository ledger.");
    }
    update((current) => ({
      ...current,
      contributors: [...current.contributors, { id: nextId(current, "human"), name, createdAt: now() }],
    }));
    event.currentTarget.reset();
    setError("");
  }

  function addIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contributorId = String(data.get("idea-contributor") ?? "");
    const title = String(data.get("idea-title") ?? "").trim();
    const detail = String(data.get("idea-detail") ?? "").trim();
    const status = String(data.get("idea-status") ?? "proposed") as ContributionStatus;
    if (!contributorId || !title || !detail) return setError("Select a contributor and describe the idea.");
    if (ledger.ideas.some((idea) => idea.title.toLowerCase() === title.toLowerCase())) {
      return setError("Record each distinct idea once; that title is already in this ledger.");
    }
    update((current) => ({
      ...current,
      ideas: [...current.ideas, { id: nextId(current, "idea"), contributorId, title, detail, status, createdAt: now() }],
    }));
    event.currentTarget.reset();
    setError("");
  }

  return (
    <section className="contributor-idea-board" id={contributorIdeaBoardId} aria-labelledby="contributor-idea-board-title">
      <div className="contribution-heading">
        <div>
          <span className="section-label">Contributor idea board</span>
          <h2 id="contributor-idea-board-title">Shape the plan before workstreams begin</h2>
          <p>Add the people and distinct ideas that should inform this project. The product goal stays separate.</p>
        </div>
        <span className="ledger-persistence">MVP: browser localStorage only</span>
      </div>
      <p className="ledger-boundary">Saved only in this browser for <code>{repository.trim().toLowerCase()}</code>. Collaboration persistence is local-browser, repository-scoped storage; it is not shared or server-backed.</p>
      {error ? <p className="ledger-error" role="alert">{error}</p> : null}
      <div className="ledger-forms idea-board-forms">
        <form onSubmit={addContributor}>
          <h3><UsersThreeIcon size={18} /> Add human contributor</h3>
          <input name="contributor-name" placeholder="e.g. Abhi or Teju" />
          <button type="submit">Add contributor</button>
        </form>
        <form onSubmit={addIdea}>
          <h3><LightbulbIcon size={18} /> Add distinct idea</h3>
          <ContributorSelect contributors={ledger.contributors} name="idea-contributor" />
          <input name="idea-title" placeholder="Idea title" />
          <textarea name="idea-detail" placeholder="What should this idea change or achieve?" rows={3} />
          <select name="idea-status">{ideaStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          <button disabled={!ledger.contributors.length} type="submit">Add idea</button>
        </form>
      </div>
      <div className="idea-register" aria-label="Idea intake register">
        <strong>{ledger.ideas.length} recorded idea{ledger.ideas.length === 1 ? "" : "s"}</strong>
        {ledger.ideas.map((idea) => {
          const contributor = ledger.contributors.find((person) => person.id === idea.contributorId);
          return <p key={idea.id}><code>{idea.id}</code> <span>{idea.status}</span> {idea.title} — {contributor?.name ?? "Unknown contributor"}</p>;
        })}
        <small>Planning includes proposed, accepted, and blended ideas. Not-selected ideas stay in the ledger but are excluded.</small>
      </div>
    </section>
  );
}

function ContributorSelect({ contributors, name }: { contributors: ContributionLedger["contributors"]; name: string }) {
  return <select name={name} defaultValue="" disabled={!contributors.length}><option value="">Select contributor</option>{contributors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>;
}

function now() { return new Date().toISOString(); }

function nextId(ledger: ContributionLedger, prefix: "human" | "idea") {
  const records = prefix === "human" ? ledger.contributors : ledger.ideas;
  const maximum = records.reduce((highest, item) => Math.max(highest, Number(item.id.split("-")[1]) || 0), 0);
  return `${prefix}-${maximum + 1}`;
}
