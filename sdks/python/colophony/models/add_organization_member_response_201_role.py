from enum import Enum

class AddOrganizationMemberResponse201Role(str, Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
