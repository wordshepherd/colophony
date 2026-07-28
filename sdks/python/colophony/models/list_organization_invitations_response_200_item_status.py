from enum import Enum


class ListOrganizationInvitationsResponse200ItemStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    PENDING = "PENDING"
    REVOKED = "REVOKED"

    def __str__(self) -> str:
        return str(self.value)
