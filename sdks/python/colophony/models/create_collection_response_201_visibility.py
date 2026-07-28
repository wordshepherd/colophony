from enum import Enum


class CreateCollectionResponse201Visibility(str, Enum):
    COLLABORATORS = "collaborators"
    PRIVATE = "private"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
