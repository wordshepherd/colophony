from enum import Enum


class WithdrawSubmissionResponse200HistoryEntryToStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    DRAFT = "DRAFT"
    HOLD = "HOLD"
    REJECTED = "REJECTED"
    REVISE_AND_RESUBMIT = "REVISE_AND_RESUBMIT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    WITHDRAWN = "WITHDRAWN"

    def __str__(self) -> str:
        return str(self.value)
