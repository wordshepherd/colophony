from enum import Enum

class ListPublicationsResponse200ItemsItemStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

    def __str__(self) -> str:
        return str(self.value)
