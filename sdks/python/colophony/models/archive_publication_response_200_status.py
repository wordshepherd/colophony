from enum import Enum

class ArchivePublicationResponse200Status(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

    def __str__(self) -> str:
        return str(self.value)
