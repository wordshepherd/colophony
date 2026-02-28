import type { SubmissionVote, VoteSummary } from '@colophony/types';
import { builder } from '../builder.js';

export const SubmissionVoteType = builder
  .objectRef<SubmissionVote>('SubmissionVote')
  .implement({
    description:
      'A vote cast by a reviewer on a submission (accept/reject/maybe + optional score).',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Vote ID.' }),
      submissionId: t.exposeString('submissionId', {
        description: 'ID of the submission.',
      }),
      voterUserId: t.exposeString('voterUserId', {
        description: 'ID of the voter.',
      }),
      voterEmail: t.exposeString('voterEmail', {
        nullable: true,
        description: "Voter's email address.",
      }),
      decision: t.exposeString('decision', {
        description: 'Vote decision: ACCEPT, REJECT, or MAYBE.',
      }),
      score: t.exposeFloat('score', {
        nullable: true,
        description: 'Optional numeric score.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the vote was cast.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the vote was last updated.',
      }),
    }),
  });

export const VoteSummaryType = builder
  .objectRef<VoteSummary>('VoteSummary')
  .implement({
    description: 'Aggregated vote tallies and average score for a submission.',
    fields: (t) => ({
      acceptCount: t.exposeInt('acceptCount', {
        description: 'Number of ACCEPT votes.',
      }),
      rejectCount: t.exposeInt('rejectCount', {
        description: 'Number of REJECT votes.',
      }),
      maybeCount: t.exposeInt('maybeCount', {
        description: 'Number of MAYBE votes.',
      }),
      totalVotes: t.exposeInt('totalVotes', {
        description: 'Total number of votes.',
      }),
      averageScore: t.exposeFloat('averageScore', {
        nullable: true,
        description: 'Average score across all votes (null if no scores).',
      }),
    }),
  });
