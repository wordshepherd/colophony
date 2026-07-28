from enum import Enum


class GetPeriodResponse200SimSubPolicyType(str, Enum):
    ALLOWED = "allowed"
    ALLOWED_NOTIFY = "allowed_notify"
    ALLOWED_WITHDRAW = "allowed_withdraw"
    PROHIBITED = "prohibited"

    def __str__(self) -> str:
        return str(self.value)
