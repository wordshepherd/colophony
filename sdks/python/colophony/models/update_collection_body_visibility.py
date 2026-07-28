from enum import Enum


class UpdateCollectionBodyVisibility(str, Enum):
    COLLABORATORS = "collaborators"
    PRIVATE = "private"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
