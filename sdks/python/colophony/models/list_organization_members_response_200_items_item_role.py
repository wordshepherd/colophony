from enum import Enum

class ListOrganizationMembersResponse200ItemsItemRole(str, Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
