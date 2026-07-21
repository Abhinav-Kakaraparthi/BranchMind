import { z } from "zod";

export const contributionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "blended",
  "not-selected",
]);

const pullRequestUrlSchema = z
  .url()
  .max(500)
  .refine(
    (url) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/i.test(url),
    "Pull-request evidence must be a GitHub pull-request URL.",
  );

const evidenceTargetSchema = z
  .object({
    workstreamKey: z.string().trim().min(1).max(80).optional(),
    pullRequestUrl: pullRequestUrlSchema.optional(),
  })
  .refine(
    (target) => Boolean(target.workstreamKey || target.pullRequestUrl),
    "Evidence must reference a workstream key or pull-request URL.",
  );

export const contributorSchema = z.object({
  id: z.string().regex(/^human-\d+$/),
  name: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime(),
});

export const ideaSchema = z.object({
  id: z.string().regex(/^idea-\d+$/),
  contributorId: z.string().regex(/^human-\d+$/),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(4000),
  status: contributionStatusSchema,
  createdAt: z.string().datetime(),
});

export const reviewEvidenceSchema = z
  .object({
    id: z.string().regex(/^review-\d+$/),
    contributorId: z.string().regex(/^human-\d+$/),
    summary: z.string().trim().min(1).max(2000),
    createdAt: z.string().datetime(),
  })
  .and(evidenceTargetSchema);

export const integrationDecisionSchema = z
  .object({
    id: z.string().regex(/^decision-\d+$/),
    contributorId: z.string().regex(/^human-\d+$/),
    selectedIdeaId: z.string().regex(/^idea-\d+$/).optional(),
    combinedIdeaIds: z.array(z.string().regex(/^idea-\d+$/)).min(2).optional(),
    rationale: z.string().trim().min(1).max(2000),
    createdAt: z.string().datetime(),
  })
  .and(evidenceTargetSchema)
  .refine(
    (decision) =>
      Boolean(decision.selectedIdeaId) !== Boolean(decision.combinedIdeaIds),
    "Record either one selected idea or two or more combined ideas.",
  );

export const contributionLedgerSchema = z.object({
  version: z.literal(1),
  contributors: z.array(contributorSchema),
  ideas: z.array(ideaSchema),
  reviews: z.array(reviewEvidenceSchema),
  decisions: z.array(integrationDecisionSchema),
});

export type ContributionLedger = z.infer<typeof contributionLedgerSchema>;
export type Contributor = z.infer<typeof contributorSchema>;
export type ContributionStatus = z.infer<typeof contributionStatusSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>;
export type IntegrationDecision = z.infer<typeof integrationDecisionSchema>;

const emptyContributionLedgerSnapshotValue: ContributionLedger = {
  version: 1,
  contributors: [],
  ideas: [],
  reviews: [],
  decisions: [],
};

Object.freeze(emptyContributionLedgerSnapshotValue.contributors);
Object.freeze(emptyContributionLedgerSnapshotValue.ideas);
Object.freeze(emptyContributionLedgerSnapshotValue.reviews);
Object.freeze(emptyContributionLedgerSnapshotValue.decisions);

export const emptyContributionLedgerSnapshot: ContributionLedger = Object.freeze(
  emptyContributionLedgerSnapshotValue,
);

export const emptyContributionLedger = (): ContributionLedger => ({
  version: 1,
  contributors: [],
  ideas: [],
  reviews: [],
  decisions: [],
});
