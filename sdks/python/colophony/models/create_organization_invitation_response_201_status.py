from enum import Enum


class CreateOrganizationInvitationResponse201Status(str, Enum):
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    PENDING = "PENDING"
    REVOKED = "REVOKED"

    def __str__(self) -> str:
        return str(self.value)
