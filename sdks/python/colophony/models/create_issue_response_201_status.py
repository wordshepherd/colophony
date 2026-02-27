from enum import Enum

class CreateIssueResponse201Status(str, Enum):
    ARCHIVED = "ARCHIVED"
    ASSEMBLING = "ASSEMBLING"
    PLANNING = "PLANNING"
    PUBLISHED = "PUBLISHED"
    READY = "READY"

    def __str__(self) -> str:
        return str(self.value)
