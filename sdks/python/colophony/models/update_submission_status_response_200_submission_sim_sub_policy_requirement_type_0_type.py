from enum import Enum


class UpdateSubmissionStatusResponse200SubmissionSimSubPolicyRequirementType0Type(str, Enum):
    NOTIFY = "notify"
    WITHDRAW = "withdraw"

    def __str__(self) -> str:
        return str(self.value)
