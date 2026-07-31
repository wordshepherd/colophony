from enum import Enum


class UpdateWebhookEndpointBodyEventTypesItem(str, Enum):
    HOPPERSUBMISSION_ACCEPTED = "hopper/submission.accepted"
    HOPPERSUBMISSION_REJECTED = "hopper/submission.rejected"
    HOPPERSUBMISSION_SUBMITTED = "hopper/submission.submitted"
    HOPPERSUBMISSION_WITHDRAWN = "hopper/submission.withdrawn"
    SLATECONTRACT_GENERATED = "slate/contract.generated"
    SLATEISSUE_PUBLISHED = "slate/issue.published"
    SLATEPIPELINE_AUTHOR_REVIEW_COMPLETED = "slate/pipeline.author-review-completed"
    SLATEPIPELINE_COPYEDITOR_ASSIGNED = "slate/pipeline.copyeditor-assigned"
    SLATEPIPELINE_COPYEDIT_COMPLETED = "slate/pipeline.copyedit-completed"
    SLATEPIPELINE_PROOFREAD_COMPLETED = "slate/pipeline.proofread-completed"
    WEBHOOK_TEST = "webhook.test"

    def __str__(self) -> str:
        return str(self.value)
