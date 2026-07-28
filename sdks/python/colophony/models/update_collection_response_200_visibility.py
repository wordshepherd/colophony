from enum import Enum


class UpdateCollectionResponse200Visibility(str, Enum):
    COLLABORATORS = "collaborators"
    PRIVATE = "private"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
