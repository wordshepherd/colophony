from enum import Enum


class CreatePeriodResponse201SimSubPolicyGenreOverridesItemType(str, Enum):
    ALLOWED = "allowed"
    ALLOWED_NOTIFY = "allowed_notify"
    ALLOWED_WITHDRAW = "allowed_withdraw"
    PROHIBITED = "prohibited"

    def __str__(self) -> str:
        return str(self.value)
