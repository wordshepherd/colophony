from enum import Enum


class UpsertNotificationPreferenceBodyEventType(str, Enum):
    CONTRACT_READY = "contract.ready"
    COPYEDITOR_ASSIGNED = "copyeditor.assigned"
    SUBMISSION_ACCEPTED = "submission.accepted"
    SUBMISSION_RECEIVED = "submission.received"
    SUBMISSION_REJECTED = "submission.rejected"
    SUBMISSION_WITHDRAWN = "submission.withdrawn"

    def __str__(self) -> str:
        return str(self.value)
