from enum import Enum

class GetFormResponse200Status(str, Enum):
    ARCHIVED = "ARCHIVED"
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"

    def __str__(self) -> str:
        return str(self.value)
