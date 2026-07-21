"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircleIcon, UsersThreeIcon } from "@phosphor-icons/react";

import type { TeamExecutionResponse } from "@/features/execution/team-request";
import type { ProjectPlan } from "@/features/planning/schema";

import { contributorIdeaBoardId } from "./idea-board";
import { type ContributionLedger } from "./schema";
import { scoreContributionLedger } from "./scoring";
import { contributionLedgerStorageKey } from "./storage";
import { useContributionLedger } from "./use-contribution-ledger";

type ContributionLedgerProps = {
  repository: string;
  plan: ProjectPlan;
  team?: TeamExecutionResponse;
};

export function ContributionLedger({ repository, plan, team }: ContributionLedgerProps) {
  const { ledger, update } = useContributionLedger(repository);
  const [error, setError] = useState("");
  const credits = useMemo(() => scoreContributionLedger(ledger, team), [ledger, team]);
  const contributors = ledger.contributors;
  const workstreamKeys = plan.workstreams.map((workstream) => workstream.key);

  function addReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contributorId = String(data.get("reviewer") ?? "");
    const summary = String(data.get("review-summary") ?? "").trim();
    const target = evidenceTarget(data);
    if (!contributorId || !summary || !validTarget(target, workstreamKeys)) {
      return setError("Review evidence needs a contributor, summary, and valid workstream key or GitHub pull-request URL.");
    }
    update((current) => ({
      ...current,
      reviews: [...current.reviews, { id: nextId(current, "review"), contributorId, summary, ...target, createdAt: now() }],
    }));
    event.currentTarget.reset();
    setError("");
  }

  function addDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contributorId = String(data.get("decision-maker") ?? "");
    const rationale = String(data.get("decision-rationale") ?? "").trim();
    const choice = String(data.get("decision-choice") ?? "");
    const target = evidenceTarget(data);
    const combined = String(data.get("combined-ideas") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    const selected = choice === "combine" ? undefined : choice;
    const validIdeas = new Set(ledger.ideas.map((idea) => idea.id));
    if (!contributorId || !rationale || !validTarget(target, workstreamKeys) || (selected && !validIdeas.has(selected)) || (!selected && (combined.length < 2 || combined.some((id) => !validIdeas.has(id))))) {
      return setError("A decision needs a contributor, rationale, evidence target, and selected idea or at least two combined ideas.");
    }
    update((current) => ({
      ...current,
      decisions: [...current.decisions, {
        id: nextId(current, "decision"), contributorId, rationale, ...target,
        ...(selected ? { selectedIdeaId: selected } : { combinedIdeaIds: combined }), createdAt: now(),
      }],
    }));
    event.currentTarget.reset();
    setError("");
  }

  return (
    <section className="contribution-ledger" id="contribution-ledger" aria-labelledby="contribution-ledger-title">
      <div className="contribution-heading">
        <div>
          <span className="section-label">Auditable contribution ledger</span>
          <h2 id="contribution-ledger-title">Who shaped this project</h2>
          <p>Evidence-only credits for human ideas, reviews, integration decisions, and completed agent implementation.</p>
        </div>
        <span className="ledger-persistence">MVP: browser localStorage only</span>
      </div>
      <p className="ledger-boundary">Saved only in this browser under <code>{contributionLedgerStorageKey(repository)}</code>. It is not shared, server-backed, or a substitute for GitHub records.</p>
      <a className="idea-intake-link" href={`#${contributorIdeaBoardId}`}>Back to contributor idea intake</a>
      <p className="ledger-policy">Fixed policy allocation, not an individual credit: every qualifying evidence event has equal weight inside its pool. There are no hidden weights.</p>
      <div className="credit-model" aria-label="Fixed contribution credit model">
        <span>Human ideas <strong>35%</strong></span><span>Human review <strong>15%</strong></span><span>Integration decisions <strong>10%</strong></span><span>Agent implementation <strong>40%</strong></span>
      </div>
      <div className="ledger-credits">
        <div className="panel-heading"><span>Credited participants</span><strong>All listed evidence accounted for</strong></div>
        {credits.map((credit) => <article className="credit-row" key={credit.recipientId}><div><strong>{credit.recipientName}</strong><span>{credit.percent}%</span></div><ul>{credit.evidence.map((evidence) => <li key={evidence.id}>{evidence.label}</li>)}</ul></article>)}
        <p className="rounding-note">Integer percentages use the largest-remainder method: floor exact event shares, then assign remaining points by fractional remainder and stable event owner ID.</p>
      </div>
      {error ? <p className="ledger-error" role="alert">{error}</p> : null}
      <div className="ledger-forms">
        <form onSubmit={addReview}><h3>Record human review</h3><ContributorSelect contributors={contributors} name="reviewer" /><input name="review-summary" placeholder="What did the review establish?" /><EvidenceTarget workstreamKeys={workstreamKeys} /><button disabled={!contributors.length} type="submit">Record review</button></form>
        <form onSubmit={addDecision}><h3>Record integration decision</h3><ContributorSelect contributors={contributors} name="decision-maker" /><select name="decision-choice" defaultValue=""><option value="">Select one idea</option>{ledger.ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}<option value="combine">Combine ideas below</option></select><input name="combined-ideas" placeholder="Idea IDs to combine, e.g. idea-1, idea-2" /><input name="decision-rationale" placeholder="Why this selection or combination?" /><EvidenceTarget workstreamKeys={workstreamKeys} /><button disabled={!contributors.length || !ledger.ideas.length} type="submit">Record decision</button></form>
      </div>
      <LedgerEvents ledger={ledger} team={team} />
    </section>
  );
}

function ContributorSelect({ contributors, name }: { contributors: ContributionLedger["contributors"]; name: string }) {
  return <select name={name} defaultValue="" disabled={!contributors.length}><option value="">Select contributor</option>{contributors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>;
}

function EvidenceTarget({ workstreamKeys }: { workstreamKeys: string[] }) {
  return <><select name="workstream-key" defaultValue=""><option value="">Workstream key (optional)</option>{workstreamKeys.map((key) => <option key={key}>{key}</option>)}</select><input name="pull-request-url" placeholder="GitHub pull-request URL (optional)" /></>;
}

function LedgerEvents({ ledger, team }: { ledger: ContributionLedger; team?: TeamExecutionResponse }) {
  const implementationCount = team?.agents.filter((agent) => agent.status === "completed" && agent.value).length ?? 0;
  return <div className="ledger-events"><h3>Evidence event register</h3><p><UsersThreeIcon size={16} /> {ledger.ideas.length} ideas, {ledger.reviews.length} reviews, {ledger.decisions.length} decisions, and {implementationCount} completed agent executions.</p>{ledger.ideas.map((idea) => <div key={idea.id}><CheckCircleIcon size={15} /> <code>{idea.id}</code> {idea.status}: {idea.title}</div>)}</div>;
}

function now() { return new Date().toISOString(); }

function nextId(ledger: ContributionLedger, prefix: "review" | "decision") {
  const records = prefix === "review" ? ledger.reviews : ledger.decisions;
  const maximum = records.reduce((highest, item) => Math.max(highest, Number(item.id.split("-")[1]) || 0), 0);
  return `${prefix}-${maximum + 1}`;
}

function evidenceTarget(data: FormData) {
  const workstreamKey = String(data.get("workstream-key") ?? "").trim();
  const pullRequestUrl = String(data.get("pull-request-url") ?? "").trim();
  return { ...(workstreamKey ? { workstreamKey } : {}), ...(pullRequestUrl ? { pullRequestUrl } : {}) };
}

function validTarget(target: { workstreamKey?: string; pullRequestUrl?: string }, keys: string[]) {
  return Boolean((target.workstreamKey && keys.includes(target.workstreamKey)) || (target.pullRequestUrl && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/i.test(target.pullRequestUrl)));
}
