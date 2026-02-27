from enum import Enum

class ListFormsResponse200ItemsItemStatus(str, Enum):
    ARCHIVED = "ARCHIVED"
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"

    def __str__(self) -> str:
        return str(self.value)
