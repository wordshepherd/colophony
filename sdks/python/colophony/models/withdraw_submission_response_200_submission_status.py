from enum import Enum

class WithdrawSubmissionResponse200SubmissionStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    DRAFT = "DRAFT"
    HOLD = "HOLD"
    REJECTED = "REJECTED"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    WITHDRAWN = "WITHDRAWN"

    def __str__(self) -> str:
        return str(self.value)
