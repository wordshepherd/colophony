from enum import Enum

class GetPublicationResponse200Status(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

    def __str__(self) -> str:
        return str(self.value)
