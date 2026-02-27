from enum import Enum

class UpdateOrganizationMemberRoleBodyRole(str, Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
