from enum import Enum

class GetCurrentUserResponse200OrganizationsItemRole(str, Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
