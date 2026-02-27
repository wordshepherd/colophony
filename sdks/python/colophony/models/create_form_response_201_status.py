from enum import Enum

class CreateFormResponse201Status(str, Enum):
    ARCHIVED = "ARCHIVED"
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"

    def __str__(self) -> str:
        return str(self.value)
