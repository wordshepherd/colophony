import type { HookDefinition } from "./types.js";

export const HOOKS = {
  "submission.created": {
    id: "submission.created",
    type: "action",
    description: "Fires after a new submission is created",
  },
  "submission.submitted": {
    id: "submission.submitted",
    type: "action",
    description: "Fires after a submission is finalized and submitted",
  },
  "submission.status_changed": {
    id: "submission.status_changed",
    type: "action",
    description: "Fires when a submission status changes",
  },
  "submission.assigned": {
    id: "submission.assigned",
    type: "action",
    description: "Fires when a submission is assigned to a reader",
  },
  "pipeline.stage_changed": {
    id: "pipeline.stage_changed",
    type: "action",
    description: "Fires when a pipeline item moves to a new stage",
  },
  "pipeline.completed": {
    id: "pipeline.completed",
    type: "action",
    description: "Fires when a pipeline item reaches completion",
  },
  "issue.published": {
    id: "issue.published",
    type: "action",
    description: "Fires when an issue is published",
  },
  "review.assigned": {
    id: "review.assigned",
    type: "action",
    description: "Fires when a reviewer is assigned to a submission",
  },
  "review.completed": {
    id: "review.completed",
    type: "action",
    description: "Fires when a review is completed",
  },
  "payment.completed": {
    id: "payment.completed",
    type: "action",
    description: "Fires when a payment is completed",
  },
  "member.joined": {
    id: "member.joined",
    type: "action",
    description: "Fires when a new member joins an organization",
  },
  "submission.validate": {
    id: "submission.validate",
    type: "filter",
    description: "Filters submission validation — handlers can add errors",
  },
  "email.before_send": {
    id: "email.before_send",
    type: "filter",
    description: "Filters email options before sending",
  },
  "submission.export": {
    id: "submission.export",
    type: "filter",
    description: "Filters submission export content",
  },
} as const satisfies Record<string, HookDefinition>;

export type HookId = keyof typeof HOOKS;
