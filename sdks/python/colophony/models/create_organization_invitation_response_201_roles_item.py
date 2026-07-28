from enum import Enum


class CreateOrganizationInvitationResponse201RolesItem(str, Enum):
    ADMIN = "ADMIN"
    BUSINESS_OPS = "BUSINESS_OPS"
    EDITOR = "EDITOR"
    PRODUCTION = "PRODUCTION"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
