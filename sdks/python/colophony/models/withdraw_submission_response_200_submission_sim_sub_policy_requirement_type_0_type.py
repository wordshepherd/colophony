from enum import Enum


class WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0Type(str, Enum):
    NOTIFY = "notify"
    WITHDRAW = "withdraw"

    def __str__(self) -> str:
        return str(self.value)
