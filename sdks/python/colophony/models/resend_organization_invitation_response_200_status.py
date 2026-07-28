from enum import Enum


class ResendOrganizationInvitationResponse200Status(str, Enum):
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    PENDING = "PENDING"
    REVOKED = "REVOKED"

    def __str__(self) -> str:
        return str(self.value)
